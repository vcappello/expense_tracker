import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ReconciliationChanges,
  ReconciliationCreateInput,
  ReconciliationUpdateInput,
} from '../context/AppContext';
import { Movement, AccountBalanceAdjustment } from '../types';
import { v4 as uuidv4 } from 'uuid';
import TitleBar from '../components/TitleBar';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import {
  BankStatement,
  BankStatementRow,
  parseBankStatementCsv,
} from '../utils/bankStatement';
import {
  ReconcileRow,
  ReconcileStatus,
  ReconciliationReport,
  reconcileStatement,
  rowComparisonDate,
  statementLineRef,
} from '../utils/reconciliation';
import { formatAmount, formatCurrency, formatDate } from '../utils/formatting';
import { getDefaultPrimaryAccount, sortAccountsPreferred } from '../utils/accounts';
import { ONLINE_LOCATION_VALUE } from '../utils/locationCategories';
import '../styles/ReconciliationPage.css';

const STATUS_LABELS: Record<ReconcileStatus, string> = {
  matched: '✓ congruente',
  ambiguous: '⚠ più candidati',
  'date-mismatch': '⚠ data diversa',
  'amount-mismatch': '⚠ importo diverso',
  'wrong-account': '🔀 altro conto',
  unmatched: '➕ da creare',
  'before-history': '⏳ prima dello storico',
};

const STATUS_TONE: Record<ReconcileStatus, string> = {
  matched: 'ok',
  ambiguous: 'warn',
  'date-mismatch': 'warn',
  'amount-mismatch': 'warn',
  'wrong-account': 'info',
  unmatched: 'missing',
  'before-history': 'history',
};

const AMOUNT_TOLERANCES = [0, 0.01, 0.05, 0.1];
const LINK_WINDOWS = [3, 5, 7, 14];

/**
 * Rows the "Solo da controllare" shortcut keeps visible: everything that is not
 * a plain congruence and not a historical row (nothing is expected before the
 * tracked history).
 */
const ACTIONABLE_STATUSES: ReconcileStatus[] = (
  Object.keys(STATUS_LABELS) as ReconcileStatus[]
).filter((status) => status !== 'matched' && status !== 'before-history');

/** Values of the result filter: the row states plus the app-only section. */
type FilterValue = ReconcileStatus | 'appOnly';

/** Inline configuration of a movement created from an unmatched bank row. */
interface CreateConfig {
  kind: 'expense' | 'cashflow' | 'routing';
  expenseTypeId: string;
  routingAccountId: string;
  isSalary: boolean;
}

type RowDecision =
  | { type: 'confirm' }
  | { type: 'update' }
  | { type: 'move' }
  | { type: 'create'; config: CreateConfig };

const rowTime = (row: BankStatementRow): string => {
  if (!row.operationDateTime) return '00:00:00';
  return [
    row.operationDateTime.getHours(),
    row.operationDateTime.getMinutes(),
    row.operationDateTime.getSeconds(),
  ]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
};

/** `YYYY-MM-DD` value for a date input (local date). */
const toInputDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

/** Parse a `YYYY-MM-DD` value coming from a date input as a local date. */
const parseInputDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

/**
 * Bank statement reconciliation — review and apply.
 * Shows the congruences between the file and the app movements and applies the
 * chosen changes in a single atomic transaction (see utils/reconciliation.ts).
 */
export default function ReconcileStatementPage() {
  const {
    accounts,
    expenseTypes,
    movements,
    loadMovements,
    loadAccounts,
    loadExpenseTypes,
    applyReconciliation,
    getAccountBalanceAtDate,
    createAccountBalanceAdjustment,
    movementsLoaded,
  } = useApp();

  const [fileName, setFileName] = useState<string | null>(null);
  const [statement, setStatement] = useState<BankStatement | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [accountId, setAccountId] = useState('');
  const [amountTolerance, setAmountTolerance] = useState(0.01);
  const [linkWindowDays, setLinkWindowDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<number, RowDecision>>({});
  const [appOnlyDeletes, setAppOnlyDeletes] = useState<Record<string, boolean>>({});
  /** Result filter (empty = show everything, the project's convention). */
  const [statusFilter, setStatusFilter] = useState<FilterValue[]>([]);
  const [expandedCreate, setExpandedCreate] = useState<number | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateConfig | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [realignOpen, setRealignOpen] = useState(false);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const [excludeBeforeHistory, setExcludeBeforeHistory] = useState(false);
  /** True once the user toggles the boundary: their choice wins over the default. */
  const [historyTouched, setHistoryTouched] = useState(false);
  /** '' = use the suggested boundary (first tracked movement / account creation). */
  const [fromDateInput, setFromDateInput] = useState('');
  const [balances, setBalances] = useState<{
    beforeOpening: number | null;
    afterClosing: number | null;
  }>({ beforeOpening: null, afterClosing: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMovements({ dateRange: 'all' });
    loadAccounts();
    loadExpenseTypes();
  }, [loadMovements, loadAccounts, loadExpenseTypes]);

  // Default account: first preferred normal account (same rule as the forms).
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(getDefaultPrimaryAccount(accounts)?.id ?? accounts[0].id);
    }
  }, [accounts, accountId]);

  const account = useMemo(
    () => accounts.find((candidate) => candidate.id === accountId),
    [accounts, accountId]
  );

  /** Start of the tracked history: earliest movement on the account, else its creation date. */
  const suggestedFromDate = useMemo(() => {
    if (!account) return null;
    const accountMovements = movements.filter(
      (movement) => movement.accountId === account.id
    );
    if (accountMovements.length === 0) return account.createdAt;
    return new Date(
      accountMovements.reduce(
        (earliest, movement) =>
          new Date(movement.date).getTime() < earliest
            ? new Date(movement.date).getTime()
            : earliest,
        new Date(accountMovements[0].date).getTime()
      )
    );
  }, [account, movements]);

  // The override and the explicit preference are dropped when the account changes.
  useEffect(() => {
    setFromDateInput('');
    setHistoryTouched(false);
  }, [accountId]);

  const fromDateValue =
    fromDateInput || (suggestedFromDate ? toInputDate(suggestedFromDate) : '');

  const report: ReconciliationReport | null = useMemo(() => {
    if (!statement || !account) return null;
    // Parsed inside the memo: a new Date object on every render would defeat it.
    const fromDate = excludeBeforeHistory
      ? parseInputDate(fromDateValue) ?? undefined
      : undefined;
    return reconcileStatement(statement.movements, movements, account, {
      amountTolerance,
      linkWindowDays,
      fromDate,
    });
  }, [
    statement,
    account,
    movements,
    amountTolerance,
    linkWindowDays,
    excludeBeforeHistory,
    fromDateValue,
  ]);

  const displayRows: ReconcileRow[] = useMemo(
    () =>
      report
        ? [...report.rows].sort(
            (a, b) => b.row.accountingDate.getTime() - a.row.accountingDate.getTime()
          )
        : [],
    [report]
  );

  const orderedAccounts = useMemo(() => sortAccountsPreferred(accounts), [accounts]);

  // Result filter: empty selection shows everything, otherwise only the chosen
  // states (and the app-only section only when 'appOnly' is among them).
  const isFiltered = statusFilter.length > 0;
  const visibleRows = isFiltered
    ? displayRows.filter((entry) => statusFilter.includes(entry.status))
    : displayRows;
  const focusMode =
    isFiltered && ACTIONABLE_STATUSES.every((status) => statusFilter.includes(status));
  const toggleFilter = (value: FilterValue): void =>
    setStatusFilter((previous) =>
      previous.includes(value)
        ? previous.filter((entry) => entry !== value)
        : [...previous, value]
    );
  const toggleFocusMode = (): void =>
    setStatusFilter(focusMode ? [] : [...ACTIONABLE_STATUSES]);

  /** First and last accounting date of the statement (its period). */
  const statementRange = useMemo(() => {
    if (!statement || statement.movements.length === 0) return null;
    return statement.movements.reduce(
      (range, row) => ({
        first: row.accountingDate < range.first ? row.accountingDate : range.first,
        last: row.accountingDate > range.last ? row.accountingDate : range.last,
      }),
      { first: statement.movements[0].accountingDate, last: statement.movements[0].accountingDate }
    );
  }, [statement]);

  // App balances around the statement period (the opening one is what reveals
  // mistakes that predate the file).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!account || !statementRange) {
        setBalances({ beforeOpening: null, afterClosing: null });
        return;
      }
      const beforeOpening = new Date(statementRange.first);
      beforeOpening.setDate(beforeOpening.getDate() - 1);
      const [beforeOpeningValue, afterClosingValue] = await Promise.all([
        getAccountBalanceAtDate(account.id, beforeOpening),
        getAccountBalanceAtDate(account.id, statementRange.last),
      ]);
      if (!cancelled) {
        setBalances({
          beforeOpening: beforeOpeningValue,
          afterClosing: afterClosingValue,
        });
      }
    };
    load().catch(() => {
      if (!cancelled) setBalances({ beforeOpening: null, afterClosing: null });
    });
    return () => {
      cancelled = true;
    };
  }, [account, statementRange, getAccountBalanceAtDate, balanceRefresh, movements]);

  const closingDelta =
    statement?.closingBalance && balances.afterClosing !== null
      ? Math.round((statement.closingBalance.amount - balances.afterClosing) * 100) / 100
      : null;

  const hasAccountMovements = useMemo(
    () => (account ? movements.some((movement) => movement.accountId === account.id) : false),
    [account, movements]
  );

  // Default of the history boundary: on when the account already has movements
  // (there is a tracked history to protect), off for a fresh account (the file
  // is probably being used to build the history). A user choice always wins.
  useEffect(() => {
    if (!historyTouched) setExcludeBeforeHistory(hasAccountMovements);
  }, [hasAccountMovements, historyTouched]);

  const categoryName = (id: string): string =>
    expenseTypes.find((type) => type.id === id)?.name ?? 'Spesa';
  const accountName = (id: string): string =>
    accounts.find((candidate) => candidate.id === id)?.name ?? '?';

  const movementSigned = (movement: Movement): number =>
    movement.type === 'expense' ? -movement.amount : movement.amount;

  const describeMovement = (movement: Movement): string =>
    movement.type === 'expense'
      ? `💸 ${categoryName(movement.expenseTypeId)}${
          movement.location ? ` · ${movement.location}` : ''
        }`
      : `${movement.isSalary ? '💼' : '💰'} Entrata · ${accountName(movement.accountId)}`;

  const movementDetail = (movement: Movement): string =>
    `${formatDate(new Date(movement.date))} · ${formatCurrency(movementSigned(movement))}`;

  const handleFile = async (file: File): Promise<void> => {
    try {
      const result = parseBankStatementCsv(await file.text());
      setStatement(result.statement);
      setWarnings(result.warnings);
      setFileName(file.name);
      setError(null);
      setDecisions({});
      setAppOnlyDeletes({});
      setExpandedCreate(null);
      setStatusFilter([]);
    } catch (err) {
      setStatement(null);
      setWarnings([]);
      setFileName(null);
      setError(err instanceof Error ? err.message : 'File non valido.');
    }
  };

  const balanceCheck =
    statement?.openingBalance && statement.closingBalance
      ? Math.round(
          (statement.closingBalance.amount - statement.openingBalance.amount) * 100
        ) /
          100 ===
        statement.net
      : null;

  const toggleDecision = (line: number, decision: RowDecision): void => {
    setDecisions((previous) => {
      const next = { ...previous };
      if (next[line]?.type === decision.type) delete next[line];
      else next[line] = decision;
      return next;
    });
  };

  const startCreate = (entry: ReconcileRow): void => {
    if (entry.suggested.type !== 'create') return;
    setExpandedCreate(entry.row.line);
    setCreateDraft({
      kind: entry.suggested.kind,
      expenseTypeId: expenseTypes[0]?.id ?? '',
      routingAccountId:
        accounts.find((candidate) => candidate.id !== accountId)?.id ?? '',
      isSalary: entry.suggested.isSalary,
    });
  };

  const buildChanges = (): ReconciliationChanges => {
    const expenseUpdates: ReconciliationUpdateInput[] = [];
    const cashflowUpdates: ReconciliationUpdateInput[] = [];
    const creates: ReconciliationCreateInput[] = [];
    const deletes: { id: string; type: 'expense' | 'cashflow' }[] = [];

    (report?.rows ?? []).forEach((entry) => {
      const decision = decisions[entry.row.line];
      if (!decision) return;
      const ref = statementLineRef(entry.row);
      const now = new Date();

      // A creation comes from an unmatched row, so it has no candidate.
      if (decision.type === 'create') {
        creates.push({
          kind: decision.config.kind,
          amount: entry.row.amount,
          date: rowComparisonDate(entry.row),
          time: rowTime(entry.row),
          accountId,
          expenseTypeId: decision.config.expenseTypeId,
          location: entry.row.merchant ?? ONLINE_LOCATION_VALUE,
          isSalary: decision.config.isSalary,
          routingAccountId: decision.config.routingAccountId,
          statementLineId: ref,
        });
        return;
      }

      const best = entry.best;
      if (!best) return;
      const target = best.movement.type === 'expense' ? expenseUpdates : cashflowUpdates;

      if (decision.type === 'confirm') {
        target.push({ id: best.movement.id, statementLineId: ref, reconciledAt: now });
      } else if (decision.type === 'update' && entry.suggested.type === 'update') {
        target.push({
          id: best.movement.id,
          ...entry.suggested.changes,
          statementLineId: ref,
          reconciledAt: now,
        });
      } else if (decision.type === 'move') {
        target.push({
          id: best.movement.id,
          accountId,
          statementLineId: ref,
          reconciledAt: now,
        });
      }
    });

    (report?.appOnly ?? []).forEach((finding) => {
      if (appOnlyDeletes[finding.movement.id]) {
        deletes.push({ id: finding.movement.id, type: finding.movement.type });
      }
    });

    return { expenseUpdates, cashflowUpdates, creates, deletes };
  };

  const pending = report ? buildChanges() : null;
  const pendingCount = pending
    ? (pending.expenseUpdates?.length ?? 0) +
      (pending.cashflowUpdates?.length ?? 0) +
      (pending.creates?.length ?? 0) +
      (pending.deletes?.length ?? 0)
    : 0;

  const handleApply = async (): Promise<void> => {
    setConfirmOpen(false);
    setApplying(true);
    try {
      const applied = await applyReconciliation(buildChanges());
      await loadMovements({ dateRange: 'all' });
      setDecisions({});
      setAppOnlyDeletes({});
      setExpandedCreate(null);
      setBalanceRefresh((value) => value + 1);
      setToast(`${applied} modifiche applicate`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Applicazione non riuscita.');
    } finally {
      setApplying(false);
    }
  };

  const handleRealign = async (): Promise<void> => {
    setRealignOpen(false);
    if (!account || !statement?.closingBalance || !statementRange) return;
    setApplying(true);
    try {
      const delta = closingDelta ?? 0;
      if (Math.abs(delta) < 0.01) {
        setToast('Nessuna differenza da riallineare');
        return;
      }
      const now = new Date();
      const adjustment: AccountBalanceAdjustment = {
        id: uuidv4(),
        accountId: account.id,
        date: statementRange.last,
        amount: delta,
        notes: 'Riconciliazione estratto conto',
        createdAt: now,
        updatedAt: now,
      };
      await createAccountBalanceAdjustment(adjustment);
      setBalanceRefresh((value) => value + 1);
      setToast(`Saldo riallineato (${formatCurrency(delta)})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riallineamento non riuscito.');
    } finally {
      setApplying(false);
    }
  };

  const renderMatch = (entry: ReconcileRow) => {
    const { best, status, row } = entry;
    if (status === 'before-history') {
      return (
        <span className="recon-match recon-match-missing">
          Precedente all'inizio dello storico — nessun corrispondente atteso
        </span>
      );
    }
    if (status === 'unmatched' || !best) {
      return (
        <span className="recon-match recon-match-missing">
          Nessun movimento corrispondente — <b>da creare</b>
        </span>
      );
    }
    const movement = best.movement;
    const detail = movementDetail(movement);
    switch (status) {
      case 'matched':
        return (
          <span className="recon-match">
            {describeMovement(movement)} · {detail}
          </span>
        );
      case 'ambiguous':
        return (
          <span className="recon-match recon-match-warn">
            {describeMovement(movement)} · {detail} — {entry.equivalentCount} candidati
            equivalenti
          </span>
        );
      case 'date-mismatch':
        return (
          <span className="recon-match recon-match-warn">
            {describeMovement(movement)} · {detail} → valuta{' '}
            {formatDate(rowComparisonDate(row))}
          </span>
        );
      case 'amount-mismatch':
        return (
          <span className="recon-match recon-match-warn">
            {describeMovement(movement)} · {detail} → estratto{' '}
            {formatCurrency(row.amount)}
          </span>
        );
      case 'wrong-account':
        return (
          <span className="recon-match recon-match-info">
            {describeMovement(movement)} · {detail} — già presente su un altro conto
          </span>
        );
      default:
        return null;
    }
  };

  const renderActions = (entry: ReconcileRow) => {
    const suggested = entry.suggested;
    const decision = decisions[entry.row.line];

    if (suggested.type === 'link') {
      return (
        <div className="recon-actions">
          <button
            type="button"
            className={`recon-action ${decision?.type === 'confirm' ? 'active' : ''}`}
            onClick={() => toggleDecision(entry.row.line, { type: 'confirm' })}
          >
            {decision?.type === 'confirm' ? '✓ sarà confermato' : 'Conferma congruenza'}
          </button>
        </div>
      );
    }

    if (suggested.type === 'update') {
      return (
        <div className="recon-actions">
          <button
            type="button"
            className={`recon-action ${decision?.type === 'update' ? 'active' : ''}`}
            onClick={() => toggleDecision(entry.row.line, { type: 'update' })}
          >
            {decision?.type === 'update'
              ? '✓ sarà corretto'
              : suggested.reasons.includes('amount')
              ? 'Correggi importo'
              : 'Correggi data'}
          </button>
        </div>
      );
    }

    if (suggested.type === 'move-account') {
      return (
        <div className="recon-actions">
          <button
            type="button"
            className={`recon-action ${decision?.type === 'move' ? 'active' : ''}`}
            onClick={() => toggleDecision(entry.row.line, { type: 'move' })}
          >
            {decision?.type === 'move' ? '✓ sarà spostato' : 'Sposta su questo conto'}
          </button>
        </div>
      );
    }

    if (suggested.type === 'create') {
      const editing = expandedCreate === entry.row.line && createDraft !== null;
      return (
        <div className="recon-actions">
          <button
            type="button"
            className={`recon-action ${decision?.type === 'create' ? 'active' : ''}`}
            onClick={() => {
              if (decision?.type === 'create') toggleDecision(entry.row.line, decision);
              else startCreate(entry);
            }}
          >
            {decision?.type === 'create' ? '✓ sarà creato' : 'Crea…'}
          </button>

          {editing && (
            <div className="recon-create-editor">
              {createDraft.kind === 'expense' && (
                <label className="recon-create-field">
                  Categoria
                  <select
                    value={createDraft.expenseTypeId}
                    onChange={(event) =>
                      setCreateDraft({
                        ...createDraft,
                        expenseTypeId: event.target.value,
                      })
                    }
                  >
                    {expenseTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {createDraft.kind === 'cashflow' && (
                <label className="recon-create-check">
                  <input
                    type="checkbox"
                    checked={createDraft.isSalary}
                    onChange={(event) =>
                      setCreateDraft({ ...createDraft, isSalary: event.target.checked })
                    }
                  />
                  Stipendio
                </label>
              )}

              {createDraft.kind === 'routing' && (
                <label className="recon-create-field">
                  Conto destinazione
                  <select
                    value={createDraft.routingAccountId}
                    onChange={(event) =>
                      setCreateDraft({
                        ...createDraft,
                        routingAccountId: event.target.value,
                      })
                    }
                  >
                    {accounts
                      .filter((candidate) => candidate.id !== accountId)
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              {suggested.couldBeRouting && createDraft.kind !== 'cashflow' && (
                <label className="recon-create-check">
                  <input
                    type="checkbox"
                    checked={createDraft.kind === 'routing'}
                    onChange={(event) =>
                      setCreateDraft({
                        ...createDraft,
                        kind: event.target.checked ? 'routing' : 'expense',
                      })
                    }
                  />
                  Trasferimento verso un altro conto
                </label>
              )}

              <div className="recon-actions">
                <button
                  type="button"
                  className="recon-action primary"
                  disabled={createDraft.kind === 'expense' && !createDraft.expenseTypeId}
                  onClick={() => {
                    toggleDecision(entry.row.line, {
                      type: 'create',
                      config: createDraft,
                    });
                    setExpandedCreate(null);
                  }}
                >
                  Conferma
                </button>
                <button
                  type="button"
                  className="recon-action"
                  onClick={() => setExpandedCreate(null)}
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="recon-page">
      <TitleBar
        title="🏦 Riconciliazione"
        actions={
          pendingCount > 0
            ? [
                {
                  content: <>✓ Applica {pendingCount}</>,
                  label: 'Applica le modifiche',
                  kind: 'primary',
                  disabled: applying,
                  onClick: () => setConfirmOpen(true),
                },
              ]
            : []
        }
      />

      <div className="recon-content">
        <section className="recon-card">
          <h2 className="recon-card-title">1 · File e conto</h2>
          <div className="recon-field">
            <label htmlFor="recon-account">Conto da riconciliare</label>
            <select
              id="recon-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {orderedAccounts.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.isPreferred ? '★ ' : ''}
                  {candidate.name}
                  {candidate.isCoinAccount ? ' (stash)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="recon-field">
            <span className="recon-label">Estratto conto (CSV)</span>
            <div className="recon-file-row">
              <button
                type="button"
                className="recon-file-button"
                onClick={() => fileInputRef.current?.click()}
              >
                📄 Scegli file
              </button>
              <span className="recon-file-name">
                {fileName ?? 'Nessun file selezionato'}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
                event.target.value = '';
              }}
            />
          </div>

          <div className="recon-options">
            <div className="recon-field">
              <label htmlFor="recon-tolerance">Tolleranza importo</label>
              <select
                id="recon-tolerance"
                value={amountTolerance}
                onChange={(event) => setAmountTolerance(Number(event.target.value))}
              >
                {AMOUNT_TOLERANCES.map((value) => (
                  <option key={value} value={value}>
                    ± {formatAmount(value)}€
                  </option>
                ))}
              </select>
            </div>
            <div className="recon-field">
              <label htmlFor="recon-window">Tolleranza date</label>
              <select
                id="recon-window"
                value={linkWindowDays}
                onChange={(event) => setLinkWindowDays(Number(event.target.value))}
              >
                {LINK_WINDOWS.map((value) => (
                  <option key={value} value={value}>
                    {value} giorni
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="recon-note">
            La tolleranza date vale solo per l'accoppiamento riga ↔ movimento (data valuta):
            <b> l'intero estratto viene sempre riconciliato</b>, qualunque sia il valore scelto.
          </p>

          <div className="recon-history">
            <label className="recon-create-check">
              <input
                type="checkbox"
                checked={excludeBeforeHistory}
                onChange={(event) => {
                  setHistoryTouched(true);
                  setExcludeBeforeHistory(event.target.checked);
                }}
              />
              Escludi le righe precedenti allo storico
            </label>
            <input
              type="date"
              value={fromDateValue}
              disabled={!excludeBeforeHistory}
              aria-label="Data di inizio dello storico"
              onChange={(event) => setFromDateInput(event.target.value)}
            />
            {suggestedFromDate && (
              <span className="recon-hint">
                Suggerito {formatDate(suggestedFromDate)} —{' '}
                {hasAccountMovements ? 'primo movimento sul conto' : 'creazione del conto'}: le
                righe precedenti non hanno un corrispondente.
              </span>
            )}
          </div>
        </section>

        {warnings.length > 0 && (
          <section className="recon-card recon-warnings">
            <h2 className="recon-card-title">Avvisi sul file</h2>
            <ul>
              {warnings.slice(0, 20).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        )}

        {statement && (
          <section className="recon-card">
            <h2 className="recon-card-title">2 · Estratto</h2>
            <dl className="recon-summary">
              <div>
                <dt>Movimenti</dt>
                <dd>{statement.movements.length}</dd>
              </div>
              <div>
                <dt>Saldo iniziale</dt>
                <dd>
                  {statement.openingBalance
                    ? formatCurrency(statement.openingBalance.amount)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Saldo finale</dt>
                <dd>
                  {statement.closingBalance
                    ? formatCurrency(statement.closingBalance.amount)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Σ movimenti</dt>
                <dd>{formatCurrency(statement.net)}</dd>
              </div>
            </dl>
            {balanceCheck !== null && (
              <p className={`recon-check ${balanceCheck ? 'ok' : 'warn'}`}>
                {balanceCheck
                  ? '✓ il totale dei movimenti coincide con saldo finale − saldo iniziale.'
                  : '⚠ il totale dei movimenti NON coincide con saldo finale − saldo iniziale.'}
              </p>
            )}
          </section>
        )}

        {!movementsLoaded ? (
          <div className="recon-loading">Caricamento movimenti...</div>
        ) : report && account ? (
          <>
            <section className="recon-card">
              <h2 className="recon-card-title">3 · Congruenze</h2>
              <div className={`recon-counters ${isFiltered ? 'filtering' : ''}`}>
                {(Object.keys(STATUS_LABELS) as ReconcileStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`recon-counter recon-${STATUS_TONE[status]} ${
                      statusFilter.includes(status) ? 'active' : ''
                    }`}
                    onClick={() => toggleFilter(status)}
                    aria-pressed={statusFilter.includes(status)}
                  >
                    {STATUS_LABELS[status]}:{' '}
                    <b>{report.summary[statusToSummaryKey(status)]}</b>
                  </button>
                ))}
                <button
                  type="button"
                  className={`recon-counter recon-info ${
                    statusFilter.includes('appOnly') ? 'active' : ''
                  }`}
                  onClick={() => toggleFilter('appOnly')}
                  aria-pressed={statusFilter.includes('appOnly')}
                >
                  non nell'estratto: <b>{report.summary.appOnly}</b>
                </button>
              </div>

              <div className="recon-filters">
                <button
                  type="button"
                  className={`recon-focus ${focusMode ? 'active' : ''}`}
                  onClick={toggleFocusMode}
                  aria-pressed={focusMode}
                >
                  🔧 Solo da controllare
                </button>
                {isFiltered && (
                  <button
                    type="button"
                    className="recon-clear"
                    onClick={() => setStatusFilter([])}
                  >
                    Mostra tutte le {displayRows.length} righe
                  </button>
                )}
              </div>
              {isFiltered && (
                <p className="recon-filter-info">
                  Mostro {visibleRows.length} di {displayRows.length} righe.
                </p>
              )}
              {statementRange && (
                <p className="recon-scope">
                  Ambito: <b>tutto l'estratto</b> ({statement?.movements.length ?? 0}{' '}
                  movimenti, contabile dal {formatDate(statementRange.first)} al{' '}
                  {formatDate(statementRange.last)}), confrontato con i movimenti del conto.
                </p>
              )}
              <p className="recon-balance-line">
                Netto app sul conto <b>{formatCurrency(report.balances.appNet)}</b> · netto
                estratto <b>{formatCurrency(report.balances.statementNet)}</b>
                {Math.abs(report.balances.appNet - report.balances.statementNet) >
                  0.01 && (
                  <span className="recon-delta">
                    {' '}
                    (differenza{' '}
                    {formatCurrency(
                      report.balances.appNet - report.balances.statementNet
                    )}
                    )
                  </span>
                )}
              </p>

              {(balances.beforeOpening !== null || balances.afterClosing !== null) && (
                <div className="recon-balances">
                  <div>
                    <span className="recon-balance-label">Saldo iniziale banca</span>
                    <span>
                      {statement?.openingBalance
                        ? formatCurrency(statement.openingBalance.amount)
                        : '—'}
                      {balances.beforeOpening !== null && (
                        <span className="recon-balance-app">
                          {' '}
                          · app {formatCurrency(balances.beforeOpening)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="recon-balance-label">Saldo finale banca</span>
                    <span>
                      {statement?.closingBalance
                        ? formatCurrency(statement.closingBalance.amount)
                        : '—'}
                      {balances.afterClosing !== null && (
                        <span className="recon-balance-app">
                          {' '}
                          · app {formatCurrency(balances.afterClosing)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {closingDelta !== null && Math.abs(closingDelta) > 0.01 && (
                <div className="recon-actions">
                  <button
                    type="button"
                    className="recon-action primary"
                    disabled={applying}
                    onClick={() => setRealignOpen(true)}
                  >
                    Riallinea il saldo ({formatCurrency(closingDelta)})
                  </button>
                </div>
              )}

              <p className="recon-note">
                Confronto indicativo: l'app data i movimenti con la data valuta, la banca con
                quella contabile.
              </p>
            </section>

            {visibleRows.length === 0 ? (
              <p className="recon-empty">
                Nessuna riga con i filtri selezionati.
              </p>
            ) : (
              <ul className="recon-list">
                {visibleRows.map((entry) => (
                <li
                  key={entry.row.line}
                  className={`recon-item recon-${STATUS_TONE[entry.status]}`}
                >
                  <div className="recon-item-main">
                    <div className="recon-item-title">
                      {entry.row.causale || 'Movimento'}
                      {entry.row.merchant ? ` · ${entry.row.merchant}` : ''}
                    </div>
                    <div className="recon-item-dates">
                      valuta {formatDate(rowComparisonDate(entry.row))}
                      {entry.row.valueDate && (
                        <span> · contabile {formatDate(entry.row.accountingDate)}</span>
                      )}
                      {entry.row.currency && entry.row.currency !== 'EUR' && (
                        <span className="recon-currency">
                          {' '}
                          {entry.row.currency}{' '}
                          {formatAmount(entry.row.foreignAmount ?? 0)}
                        </span>
                      )}
                    </div>
                    <div className="recon-item-match">{renderMatch(entry)}</div>
                    {renderActions(entry)}
                  </div>
                  <div
                    className={`recon-amount ${entry.row.amount < 0 ? 'out' : 'in'}`}
                  >
                    {formatCurrency(entry.row.amount)}
                  </div>
                </li>
              ))}
              </ul>
            )}

            {report.appOnly.length > 0 &&
              (!isFiltered || statusFilter.includes('appOnly')) && (
              <section className="recon-card">
                <h2 className="recon-card-title">
                  Movimenti del conto non presenti nell'estratto
                </h2>
                <ul className="recon-apponly">
                  {report.appOnly.map((finding) => (
                    <li key={finding.movement.id}>
                      <span className="recon-match">
                        {describeMovement(finding.movement)} ·{' '}
                        {movementDetail(finding.movement)}
                      </span>
                      <span className="recon-apponly-actions">
                        <span
                          className={`recon-badge ${
                            finding.reason === 'duplicate' ? 'warn' : 'missing'
                          }`}
                        >
                          {finding.reason === 'duplicate'
                            ? 'possibile duplicato'
                            : "non nell'estratto"}
                        </span>
                        {finding.movement.routingPairId ? (
                          <span className="recon-badge missing">
                            gestisci dalla modifica
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={`recon-action ${
                              appOnlyDeletes[finding.movement.id] ? 'active' : ''
                            }`}
                            onClick={() =>
                              setAppOnlyDeletes((previous) => ({
                                ...previous,
                                [finding.movement.id]: !previous[finding.movement.id],
                              }))
                            }
                          >
                            {appOnlyDeletes[finding.movement.id]
                              ? '✓ sarà eliminato'
                              : 'Elimina'}
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <div className="recon-empty">
            <p>Seleziona l'estratto conto della banca per vedere le congruenze.</p>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Applicare le modifiche?"
        confirmLabel="Applica"
        lines={
          <ul className="recon-confirm-list">
            <li>
              Correzioni movimenti:{' '}
              <b>
                {(pending?.expenseUpdates?.length ?? 0) +
                  (pending?.cashflowUpdates?.length ?? 0)}
              </b>
            </li>
            <li>
              Nuovi movimenti: <b>{pending?.creates?.length ?? 0}</b>
            </li>
            <li>
              Eliminazioni: <b>{pending?.deletes?.length ?? 0}</b>
            </li>
          </ul>
        }
        onConfirm={handleApply}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmModal
        open={realignOpen}
        title="Riallineare il saldo del conto?"
        confirmLabel="Riallinea"
        lines={
          <>
            <p>
              Verrà creata una rettifica di saldo datata{' '}
              <b>
                {statementRange ? formatDate(statementRange.last) : '—'}
              </b>{' '}
              per portare il conto al saldo finale dell'estratto.
            </p>
            <ul className="recon-confirm-list">
              <li>
                Saldo banca finale:{' '}
                <b>
                  {statement?.closingBalance
                    ? formatCurrency(statement.closingBalance.amount)
                    : '—'}
                </b>
              </li>
              <li>
                Saldo app: <b>{balances.afterClosing !== null ? formatCurrency(balances.afterClosing) : '—'}</b>
              </li>
              <li>
                Differenza: <b>{closingDelta !== null ? formatCurrency(closingDelta) : '—'}</b>
              </li>
            </ul>
          </>
        }
        onConfirm={handleRealign}
        onCancel={() => setRealignOpen(false)}
      />

      <AlertModal
        open={error !== null}
        title="Errore"
        message={error ?? ''}
        onClose={() => setError(null)}
      />

      <Toast message={toast} />
    </div>
  );
}

/** Maps a status to the matching key of the report summary. */
const statusToSummaryKey = (
  status: ReconcileStatus
):
  | 'matched'
  | 'ambiguous'
  | 'dateMismatch'
  | 'amountMismatch'
  | 'wrongAccount'
  | 'unmatched'
  | 'beforeHistory' => {
  switch (status) {
    case 'date-mismatch':
      return 'dateMismatch';
    case 'amount-mismatch':
      return 'amountMismatch';
    case 'wrong-account':
      return 'wrongAccount';
    case 'ambiguous':
      return 'ambiguous';
    case 'unmatched':
      return 'unmatched';
    case 'before-history':
      return 'beforeHistory';
    default:
      return 'matched';
  }
};
