/**
 * Reconciliation of a bank statement with the app movements.
 *
 * The comparison is **bidirectional**: it links the bank rows to the app
 * movements (per account, per period) and also reports the movements found only
 * in the app (`appOnly`), which is where the entry mistakes live — duplicates,
 * wrong account, wrong amount, movements that do not exist in the statement.
 *
 * Key rules:
 * - the account balance is affected only by the movements whose `accountId`
 *   equals the account (expenses stored positive → negative effect);
 * - the date used for the comparison is **DATA VALUTA** (fallback: the
 *   accounting date), because it is the purchase date also for foreign
 *   currency card payments;
 * - the matching is one-to-one (a movement cannot be linked to two rows);
 * - the module is pure: it only computes a report, it never writes to the DB.
 *   Applying the suggested decisions is the caller's responsibility.
 */

import type { Account, Movement } from '../types';
import type { BankStatementRow } from './bankStatement';

const MS_PER_DAY = 86_400_000;

// Score weights (amount is the strongest signal, then the date, then the text).
const AMOUNT_WEIGHT = 0.55;
const DATE_WEIGHT = 0.25;
const TEXT_WEIGHT = 0.2;

/** Minimum text overlap to consider two descriptions the same place. */
const PLAUSIBLE_TEXT_SCORE = 0.34;

/** Same amount within this tolerance is considered congruent. */
const DEFAULT_AMOUNT_TOLERANCE = 0.01;
/** Day distance within which two dates are considered congruent. */
const DEFAULT_DATE_WINDOW_DAYS = 3;
/**
 * Maximum day distance for linking a movement to a row at all. Kept
 * conservative because bank amounts repeat very often (e.g. a 5,95 coffee):
 * without this cap an amount-equal movement months away would be linked.
 */
const DEFAULT_LINK_WINDOW_DAYS = 7;

export type ReconcileStatus =
  | 'matched'
  | 'ambiguous'
  | 'date-mismatch'
  | 'amount-mismatch'
  | 'wrong-account'
  | 'unmatched'
  /** Before the tracked history (before `fromDate`): no counterpart is expected. */
  | 'before-history';

export interface ReconcileCandidate {
  movement: Movement;
  /** Bank amount minus the movement's signed effect on the account. */
  amountDelta: number;
  /** Signed day distance between the value date and the movement date. */
  dateDeltaDays: number;
  /** 0..1 similarity between the bank description and the movement text. */
  textScore: number;
  /** 0..1 global score used for the one-to-one assignment. */
  score: number;
  amountMatches: boolean;
  dateMatches: boolean;
  /** False when the movement belongs to another account. */
  onReconciledAccount: boolean;
}

/** Fields the reconciliation may propose to update on an existing movement. */
export interface ReconcileUpdate {
  amount?: number;
  date?: Date;
  time?: string;
}

export type ReconcileDecision =
  | { type: 'link' }
  | { type: 'update'; changes: ReconcileUpdate; reasons: ('amount' | 'date')[] }
  | { type: 'move-account'; accountId: string }
  | {
      type: 'create';
      kind: 'expense' | 'cashflow';
      amount: number;
      isSalary: boolean;
      /** True when the description looks like an internal transfer (withdrawal, top-up, outgoing transfer). */
      couldBeRouting: boolean;
    }
  | { type: 'ignore' };

export interface ReconcileRow {
  row: BankStatementRow;
  status: ReconcileStatus;
  /** Best candidate (set unless the row is truly unmatched). */
  best: ReconcileCandidate | null;
  /** Other plausible candidates, best first (the UI can switch the link). */
  alternatives: ReconcileCandidate[];
  /**
   * Number of candidates that are fully congruent on the reconciled account
   * (same amount, inside the link window): > 1 signals a likely duplicate.
   */
  equivalentCount: number;
  suggested: ReconcileDecision;
}

export type AppOnlyReason = 'duplicate' | 'unmatched-app';

export interface AppOnlyFinding {
  movement: Movement;
  reason: AppOnlyReason;
}

export interface ReconciliationSummary {
  bankRows: number;
  matched: number;
  ambiguous: number;
  dateMismatch: number;
  amountMismatch: number;
  wrongAccount: number;
  unmatched: number;
  /** Rows before the tracked history (excluded from the pending work). */
  beforeHistory: number;
  appOnly: number;
}

export interface ReconciliationReport {
  rows: ReconcileRow[];
  /** Movements of the reconciled account, inside the statement window, with no bank row. */
  appOnly: AppOnlyFinding[];
  summary: ReconciliationSummary;
  balances: {
    /** Sum of the statement movements (equals closing − opening when both anchors exist). */
    statementNet: number;
    /** Net effect on the account of the app movements inside the window. */
    appNet: number;
  };
  /** Movements of the reconciled account inside the statement window. */
  accountMovements: Movement[];
}

export interface ReconcileOptions {
  amountTolerance?: number;
  /** Day distance within which the date is considered congruent (no update proposed). */
  dateWindowDays?: number;
  /** Maximum day distance for linking a movement to a row at all. */
  linkWindowDays?: number;
  /** Max alternatives returned per bank row. */
  maxCandidates?: number;
  /**
   * Extra days kept around the statement period when looking for candidates.
   * The largest contabile/valuta gap of the file is always added on top.
   */
  periodMarginDays?: number;
  /**
   * Start of the tracked history (usually the account creation date or the
   * first recorded movement): rows before it cannot have a counterpart and are
   * reported as `before-history` instead of "to create".
   */
  fromDate?: Date;
}

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** Signed effect of an app movement on the balance of its own account. */
const signedMovementAmount = (movement: Movement): number =>
  movement.type === 'expense' ? -movement.amount : movement.amount;

/** A movement with the amount that really hits the bank account. */
interface BankMovement {
  movement: Movement;
  amount: number;
}

/**
 * Movements that have a real counterpart in the bank statement, with their
 * effective bank amount:
 * - a coin-split expense is reduced by the part paid from the untracked stash
 *   (the bank row shows only the part actually charged);
 * - the internal receiving leg of a coin-split group is an app-internal record
 *   (it does not exist in the statement) and is dropped.
 * Genuine routing legs (e.g. an ATM withdrawal) are kept: they do appear in the
 * statement as a movement of the reconciled account.
 */
const buildBankMovements = (movements: Movement[]): BankMovement[] => {
  const coinSplitPairIds = new Set<string>();
  movements.forEach((movement) => {
    if (movement.type === 'expense' && movement.routingPairId) {
      coinSplitPairIds.add(movement.routingPairId);
    }
  });

  const internalIds = new Set<string>();
  const stashPartByPairAccount = new Map<string, number>();
  movements.forEach((movement) => {
    if (
      movement.type === 'cashflow' &&
      movement.routingPairId &&
      movement.routingAccountId &&
      movement.amount > 0 &&
      coinSplitPairIds.has(movement.routingPairId)
    ) {
      internalIds.add(movement.id);
      const key = `${movement.routingPairId}|${movement.accountId}`;
      stashPartByPairAccount.set(
        key,
        (stashPartByPairAccount.get(key) ?? 0) + movement.amount
      );
    }
  });

  return movements
    .filter((movement) => !internalIds.has(movement.id))
    .map((movement) => {
      const stashPart =
        movement.type === 'expense' && movement.routingPairId
          ? stashPartByPairAccount.get(`${movement.routingPairId}|${movement.accountId}`) ?? 0
          : 0;
      return {
        movement,
        amount:
          movement.type === 'expense'
            ? -(movement.amount - stashPart)
            : movement.amount,
      };
    });
};

/** Date compared with the bank row: value date when available, else accounting date. */
export const rowComparisonDate = (row: BankStatementRow): Date =>
  row.valueDate ?? row.accountingDate;

const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

/**
 * Stable reference of a bank row, stored on the reconciled movement
 * (`statementLineId`): it documents the provenance and makes a second import of
 * the same statement recognise the rows already reconciled.
 */
export const statementLineRef = (row: BankStatementRow): string =>
  [
    isoDay(row.accountingDate),
    row.valueDate ? isoDay(row.valueDate) : '',
    row.amount.toFixed(2),
    row.causale,
    row.merchant ?? '',
    row.cardLast4 ?? '',
  ].join('|');

const formatTime = (date: Date): string =>
  [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');

const STOP_WORDS = new Set(['online', 'nessun', 'luogo', 'della', 'delle', 'presso']);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9àèéìòù]+/g, ' ')
    .split(' ')
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

/** Overlap of the shorter token set (1 = the shorter text is fully contained). */
const textOverlap = (left: string, right: string): number => {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  smaller.forEach((token) => {
    if (larger.has(token)) shared += 1;
  });
  return shared / smaller.size;
};

/** Text corpus of the movement (expenses only: location and notes). */
const movementText = (movement: Movement): string =>
  movement.type === 'expense'
    ? `${movement.location ?? ''} ${movement.notes ?? ''}`
    : '';

/** Text corpus of the bank row (causale + merchant, not the noisy full description). */
const rowText = (row: BankStatementRow): string =>
  `${row.causale} ${row.merchant ?? ''}`;

const looksLikeTransfer = (row: BankStatementRow): boolean =>
  /prelievo|ricarica|giroconto|bonifico in uscita|trasferimento/i.test(
    `${row.causale} ${row.description}`
  );

/** Suggested amount stored on an expense (positive) or on a cashflow (signed). */
export const suggestedAmount = (
  kind: 'expense' | 'cashflow',
  bankAmount: number
): number => (kind === 'expense' ? Math.abs(bankAmount) : bankAmount);

export const reconcileStatement = (
  rows: BankStatementRow[],
  movements: Movement[],
  account: Account,
  options: ReconcileOptions = {}
): ReconciliationReport => {
  const amountTolerance = options.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
  const dateWindowDays = options.dateWindowDays ?? DEFAULT_DATE_WINDOW_DAYS;
  const linkWindowDays = options.linkWindowDays ?? DEFAULT_LINK_WINDOW_DAYS;
  const maxCandidates = options.maxCandidates ?? 4;
  const periodMarginDays = options.periodMarginDays ?? 2;
  const fromDate = options.fromDate;

  const emptyReport = (): ReconciliationReport => ({
    rows: [],
    appOnly: [],
    summary: {
      bankRows: 0,
      matched: 0,
      ambiguous: 0,
      dateMismatch: 0,
      amountMismatch: 0,
      wrongAccount: 0,
      unmatched: 0,
      beforeHistory: 0,
      appOnly: 0,
    },
    balances: {
      statementNet: 0,
      appNet: 0,
    },
    accountMovements: [],
  });

  if (rows.length === 0) return emptyReport();

  const times = rows.map((row) => startOfDay(row.accountingDate).getTime());
  const minTime = times.reduce((min, time) => (time < min ? time : min), times[0]);
  const maxTime = times.reduce((max, time) => (time > max ? time : max), times[0]);

  // The candidate window is the whole statement period, widened by the largest
  // contabile/valuta gap of the file: a card payment is often posted days after
  // the purchase, so a fixed margin could leave the value date of the first or
  // last rows out of scope.
  const maxValueOffsetDays = rows.reduce((max, row) => {
    if (!row.valueDate) return max;
    const offset = Math.round(
      Math.abs(
        startOfDay(row.accountingDate).getTime() -
          startOfDay(row.valueDate).getTime()
      ) / MS_PER_DAY
    );
    return Math.max(max, offset);
  }, 0);
  const marginDays = periodMarginDays + maxValueOffsetDays;
  const windowStart = minTime - marginDays * MS_PER_DAY;
  const windowEnd = maxTime + marginDays * MS_PER_DAY;

  const isInWindow = (movement: Movement): boolean => {
    const time = startOfDay(new Date(movement.date)).getTime();
    return time >= windowStart && time <= windowEnd;
  };

  // Rows before the tracked history have no counterpart by definition.
  const fromTime = fromDate ? startOfDay(fromDate).getTime() : null;
  const isBeforeHistory = (row: BankStatementRow): boolean =>
    fromTime !== null && startOfDay(rowComparisonDate(row)).getTime() < fromTime;

  /** Decision proposed for a row with no counterpart (to create or to skip). */
  const buildCreateDecision = (row: BankStatementRow): ReconcileDecision => {
    const isIncome = row.amount > 0;
    return {
      type: 'create',
      kind: isIncome ? 'cashflow' : 'expense',
      amount: suggestedAmount(isIncome ? 'cashflow' : 'expense', row.amount),
      isSalary: /stipendio|pensione/i.test(`${row.causale} ${row.description}`),
      couldBeRouting: !isIncome && looksLikeTransfer(row),
    };
  };

  // Only movements with a real counterpart in the statement take part in the
  // matching (the internal coin-split legs are dropped, the coin-split expense
  // is compared with its effective bank amount).
  const inWindow = buildBankMovements(movements).filter((entry) =>
    isInWindow(entry.movement)
  );
  const bankAmountById = new Map(
    inWindow.map((entry) => [entry.movement.id, entry.amount])
  );

  const buildCandidate = (
    row: BankStatementRow,
    entry: BankMovement
  ): ReconcileCandidate => {
    const { movement } = entry;
    const signed = entry.amount;
    const amountDelta = round2(row.amount - signed);
    const amountMatches = Math.abs(amountDelta) <= amountTolerance;
    const dateDeltaDays = Math.round(
      (startOfDay(new Date(movement.date)).getTime() -
        startOfDay(rowComparisonDate(row)).getTime()) /
        MS_PER_DAY
    );
    const absDateDelta = Math.abs(dateDeltaDays);
    const dateMatches = absDateDelta <= dateWindowDays;
    const textScore = round3(textOverlap(rowText(row), movementText(movement)));
    const amountScore = amountMatches ? 1 : 1 / (1 + Math.abs(amountDelta));
    const dateScore = 1 / (1 + absDateDelta);
    const score = round3(
      AMOUNT_WEIGHT * amountScore + DATE_WEIGHT * dateScore + TEXT_WEIGHT * textScore
    );
    return {
      movement,
      amountDelta,
      dateDeltaDays,
      textScore,
      score,
      amountMatches,
      dateMatches,
      onReconciledAccount: movement.accountId === account.id,
    };
  };

  // A candidate is only useful within the linking window (or for the text/date
  // based amount-mismatch proposal), so the far movements are skipped early to
  // keep the O(rows × movements) scan small.
  const candidateWindowDays = Math.max(dateWindowDays, linkWindowDays) + 1;
  const candidatesByRow = rows.map((row) => {
    const rowTime = startOfDay(rowComparisonDate(row)).getTime();
    return inWindow
      .filter(
        (entry) =>
          Math.abs(
            (startOfDay(new Date(entry.movement.date)).getTime() - rowTime) / MS_PER_DAY
          ) <= candidateWindowDays
      )
      .map((entry) => buildCandidate(row, entry))
      .filter(
        (candidate) =>
          candidate.amountMatches ||
          candidate.dateMatches ||
          candidate.textScore > 0
      )
      .sort((a, b) => b.score - a.score || Math.abs(a.dateDeltaDays) - Math.abs(b.dateDeltaDays))
      .slice(0, maxCandidates);
  });

  // One-to-one assignment on the reconciled account (amount-congruent pairs).
  const pairPool: { rowIndex: number; candidate: ReconcileCandidate }[] = [];
  candidatesByRow.forEach((candidates, rowIndex) => {
    if (isBeforeHistory(rows[rowIndex])) return;
    candidates.forEach((candidate) => {
      if (
        candidate.amountMatches &&
        candidate.onReconciledAccount &&
        Math.abs(candidate.dateDeltaDays) <= linkWindowDays
      ) {
        pairPool.push({ rowIndex, candidate });
      }
    });
  });
  pairPool.sort((a, b) => b.candidate.score - a.candidate.score);

  const linkedByRow = new Map<number, ReconcileCandidate>();
  const linkedMovementIds = new Set<string>();
  pairPool.forEach(({ rowIndex, candidate }) => {
    if (linkedByRow.has(rowIndex) || linkedMovementIds.has(candidate.movement.id)) return;
    linkedByRow.set(rowIndex, candidate);
    linkedMovementIds.add(candidate.movement.id);
  });

  /** Movement explicitly referenced by a row decision (link or proposal). */
  const referencedMovementIds = new Set<string>(linkedMovementIds);

  const reconcileRows: ReconcileRow[] = rows.map((row, rowIndex) => {
    const candidates = candidatesByRow[rowIndex];
    const linked = linkedByRow.get(rowIndex);

    if (isBeforeHistory(row)) {
      return {
        row,
        status: 'before-history',
        best: null,
        alternatives: [],
        equivalentCount: 0,
        suggested: buildCreateDecision(row),
      };
    }

    if (linked) {
      const equivalent = candidates.filter(
        (candidate) =>
          candidate.amountMatches &&
          candidate.onReconciledAccount &&
          Math.abs(candidate.dateDeltaDays) <= linkWindowDays
      );
      const ambiguous = equivalent.some(
        (candidate) =>
          candidate.movement.id !== linked.movement.id &&
          Math.abs(candidate.score - linked.score) < 0.02
      );
      const alternatives = candidates.filter(
        (candidate) => candidate.movement.id !== linked.movement.id
      );
      if (linked.dateMatches) {
        return {
          row,
          status: ambiguous ? 'ambiguous' : 'matched',
          best: linked,
          alternatives,
          equivalentCount: equivalent.length,
          suggested: { type: 'link' },
        };
      }
      const changes: ReconcileUpdate = { date: rowComparisonDate(row) };
      if (row.operationDateTime) changes.time = formatTime(row.operationDateTime);
      return {
        row,
        status: 'date-mismatch',
        best: linked,
        alternatives,
        equivalentCount: equivalent.length,
        suggested: { type: 'update', changes, reasons: ['date'] },
      };
    }

    // Exact amount on another account: the expense exists but on the wrong account.
    const otherAccountExact = candidates.find(
      (candidate) => candidate.amountMatches && !candidate.onReconciledAccount
    );
    if (
      otherAccountExact &&
      Math.abs(otherAccountExact.dateDeltaDays) <= linkWindowDays
    ) {
      referencedMovementIds.add(otherAccountExact.movement.id);
      return {
        row,
        status: 'wrong-account',
        best: otherAccountExact,
        alternatives: candidates.filter(
          (candidate) => candidate.movement.id !== otherAccountExact.movement.id
        ),
        equivalentCount: 0,
        suggested: { type: 'move-account', accountId: account.id },
      };
    }

    // Plausible identity (same day and similar text) but a different amount:
    // a mistyped amount, or a foreign currency conversion.
    const plausible = candidates.find(
      (candidate) =>
        candidate.dateMatches &&
        candidate.textScore >= PLAUSIBLE_TEXT_SCORE &&
        !candidate.amountMatches
    );
    if (plausible) {
      referencedMovementIds.add(plausible.movement.id);
      const changes: ReconcileUpdate = {
        amount: suggestedAmount(plausible.movement.type, row.amount),
      };
      if (!plausible.onReconciledAccount) {
        return {
          row,
          status: 'wrong-account',
          best: plausible,
          alternatives: candidates.filter(
            (candidate) => candidate.movement.id !== plausible.movement.id
          ),
          equivalentCount: 0,
          suggested: { type: 'move-account', accountId: account.id },
        };
      }
      return {
        row,
        status: 'amount-mismatch',
        best: plausible,
        alternatives: candidates.filter(
          (candidate) => candidate.movement.id !== plausible.movement.id
        ),
        equivalentCount: 0,
        suggested: { type: 'update', changes, reasons: ['amount'] },
      };
    }

    return {
      row,
      status: 'unmatched',
      best: null,
      alternatives: candidates,
      equivalentCount: 0,
      suggested: buildCreateDecision(row),
    };
  });

  // Movements of the reconciled account inside the window with no bank row.
  const accountMovements = inWindow
    .filter((entry) => entry.movement.accountId === account.id)
    .map((entry) => entry.movement);
  const appOnly: AppOnlyFinding[] = accountMovements
    .filter((movement) => !referencedMovementIds.has(movement.id))
    .map((movement) => ({
      movement,
      reason: accountMovements.some(
        (other) =>
          other.id !== movement.id &&
          referencedMovementIds.has(other.id) &&
          Math.abs(
            (bankAmountById.get(other.id) ?? 0) -
              (bankAmountById.get(movement.id) ?? 0)
          ) <= amountTolerance &&
          startOfDay(new Date(other.date)).getTime() ===
            startOfDay(new Date(movement.date)).getTime()
      )
        ? 'duplicate'
        : 'unmatched-app',
    }));

  const countStatus = (status: ReconcileStatus): number =>
    reconcileRows.filter((entry) => entry.status === status).length;

  return {
    rows: reconcileRows,
    appOnly,
    summary: {
      bankRows: rows.length,
      matched: countStatus('matched'),
      ambiguous: countStatus('ambiguous'),
      dateMismatch: countStatus('date-mismatch'),
      amountMismatch: countStatus('amount-mismatch'),
      wrongAccount: countStatus('wrong-account'),
      unmatched: countStatus('unmatched'),
      beforeHistory: countStatus('before-history'),
      appOnly: appOnly.length,
    },
    balances: {
      statementNet: round2(rows.reduce((sum, row) => sum + row.amount, 0)),
      // Uses every movement of the account (internal coin-split legs included),
      // so it stays consistent with the app balance (getAccountBalance).
      appNet: account.isCoinAccount
        ? 0
        : round2(
            movements
              .filter(
                (movement) =>
                  movement.accountId === account.id && isInWindow(movement)
              )
              .reduce((sum, movement) => sum + signedMovementAmount(movement), 0)
          ),
    },
    accountMovements,
  };
};
