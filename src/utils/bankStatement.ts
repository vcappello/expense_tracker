/**
 * Parsing of Italian bank statement and rechargeable-card CSV exports.
 *
 * Bank statement layout:
 *   DATA CONTABILE,DATA VALUTA,USCITE,ENTRATE,CAUSALE,DESCRIZIONE OPERAZIONE
 * - accounting date (contabile): when the bank posts the movement;
 * - value date (valuta): the date comparable with the expense date (for card
 *   payments it is the day of the purchase, also for foreign currency ones);
 * - amounts are in Italian format (`+8.102,60`, `-5,95`) in two separate
 *   columns: USCITE negative, ENTRATE positive;
 * - the description carries extra data (merchant, operation date/time,
 *   original currency/amount, card number) that is extracted here;
 * - two anchor rows (`Saldo iniziale` / `Saldo finale`) carry the opening and
 *   closing balances and are not movements.
 *
 * Rechargeable-card layout:
 *   DATA OPERAZIONE,DESCRIZIONE OPERAZIONE,IMPORTO IN EURO
 * The signed amount distinguishes expenses and income; the optional `Totale`
 * row is validated but is not a balance anchor.
 *
 * Pure module (no DOM, no app types): the parsing can be validated on its own.
 */

type BankStatementRowKind = 'movement' | 'opening-balance' | 'closing-balance';

export type BankStatementFormat = 'bank' | 'card';

export interface BankStatementRow {
  /** 1-based data row number in the file (header excluded). */
  line: number;
  /** Source layout, used to keep card transaction references distinct. */
  format: BankStatementFormat;
  /** DATA CONTABILE or DATA OPERAZIONE, depending on the source layout. */
  accountingDate: Date;
  /** DATA VALUTA for bank exports (null when the source has no value date). */
  valueDate: Date | null;
  /** Signed amount in EUR: outgoings negative, incoming positive. */
  amount: number;
  /** Bank causale (e.g. "Pagamento Carta", "Accredito Stipendio/Pensione"). */
  causale: string;
  /** Full operation description. */
  description: string;
  /** Merchant/place extracted from "presso …" (null when not derivable). */
  merchant: string | null;
  /** Operation date/time extracted from "del … alle ore …" (null if absent). */
  operationDateTime: Date | null;
  /** Original currency of the card payment ("EUR", "CHF", …) when declared. */
  currency: string | null;
  /** Original amount in the card currency (before the EUR conversion). */
  foreignAmount: number | null;
  /** Last 4 digits of the card used for the payment. */
  cardLast4: string | null;
}

export interface BankStatementBalanceAnchor {
  date: Date;
  amount: number;
}

export interface BankStatement {
  format: BankStatementFormat;
  movements: BankStatementRow[];
  openingBalance: BankStatementBalanceAnchor | null;
  closingBalance: BankStatementBalanceAnchor | null;
  /** Sum of the movements: equals closing − opening when both anchors exist. */
  net: number;
}

export interface BankStatementParseResult {
  statement: BankStatement;
  /** Non-blocking issues found while parsing (skipped/invalid rows). */
  warnings: string[];
}

const HEADER_FIRST_COLUMN = 'DATA CONTABILE';
const CARD_HEADER = ['DATA OPERAZIONE', 'DESCRIZIONE OPERAZIONE', 'IMPORTO IN EURO'];

/** Split a CSV payload (RFC 4180: quotes, escaped quotes, CRLF and LF, BOM). */
const splitCsvRows = (text: string): string[][] => {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRow();
    } else if (char === '\r') {
      // A lone CR is a line separator only when it is not part of CRLF.
      if (source[i + 1] !== '\n') pushRow();
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) pushRow();
  return rows;
};

/**
 * Parse a bank amount column: Italian format with `.` as thousands separator
 * and `,` as decimal separator, with an optional explicit sign.
 */
const parseBankAmount = (raw: string): number | null => {
  const value = raw.trim();
  if (!value) return null;
  const negative = value.startsWith('-');
  const body = value.replace(/^[+-]/, '').replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(body)) return null;
  const parsed = Number(body);
  if (Number.isNaN(parsed)) return null;
  return negative ? -parsed : parsed;
};

/**
 * Parse a number appearing inside the description, where both the Italian and
 * the dot-decimal convention can show up (e.g. `Importo in Euro=9.78`,
 * `Tasso di cambio CHF/EUR=1,086666`). The rightmost separator is the decimal
 * one, the other groups thousands.
 */
const parseLooseNumber = (raw: string): number | null => {
  let value = raw.trim();
  if (!value) return null;
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    value =
      lastComma > lastDot
        ? value.replace(/\./g, '').replace(',', '.')
        : value.replace(/,/g, '');
  } else if (lastComma > -1) {
    value = value.replace(',', '.');
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/** Parse a `DD/MM/YYYY` date as a local date (same convention as the app). */
const parseBankDate = (raw: string): Date | null => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
};

const extractMerchant = (description: string): string | null => {
  const match = /presso\s+(.+?)(?:\.\s*Tasso di cambio|\s+-\s+Transazione|,\s*C-less|$)/i.exec(
    description
  );
  const merchant = match?.[1]?.trim();
  return merchant ? merchant : null;
};

const extractOperationDateTime = (description: string): Date | null => {
  const match =
    /del\s+(\d{2})\/(\d{2})\/(\d{4})\s+alle ore\s+(\d{2}):(\d{2})/.exec(description);
  if (!match) return null;
  return new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
    Number(match[4]),
    Number(match[5])
  );
};

const detectKind = (description: string): BankStatementRowKind => {
  if (/saldo iniziale/i.test(description)) return 'opening-balance';
  if (/saldo finale/i.test(description)) return 'closing-balance';
  return 'movement';
};

const parseCardStatement = (rawRows: string[][]): BankStatementParseResult => {
  const warnings: string[] = [];
  const movements: BankStatementRow[] = [];
  const declaredTotal: { value: number | null } = { value: null };

  rawRows.slice(1).forEach((cells, index) => {
    const line = index + 1;
    const [dateRaw = '', descriptionRaw = '', amountRaw = ''] = cells;
    const description = descriptionRaw.trim();
    if (/^totale$/i.test(description)) {
      declaredTotal.value = parseBankAmount(amountRaw);
      if (declaredTotal.value === null) {
        warnings.push(`Riga ${line}: totale dichiarato non valido.`);
      }
      return;
    }

    const date = parseBankDate(dateRaw);
    const amount = parseBankAmount(amountRaw);
    if (!date || amount === null || !description) {
      warnings.push(`Riga ${line}: data, descrizione o importo non validi, riga ignorata.`);
      return;
    }

    const recharge = /ricarica/i.test(description);
    movements.push({
      line,
      format: 'card',
      accountingDate: date,
      valueDate: null,
      amount,
      causale: recharge ? description : 'Operazione carta',
      description,
      merchant: extractMerchant(description),
      operationDateTime: null,
      currency: null,
      foreignAmount: null,
      cardLast4: null,
    });
  });

  if (movements.length === 0) {
    warnings.push('Nessun movimento trovato nel file.');
  }

  const net = getStatementNet(movements);
  if (declaredTotal.value !== null && Math.abs(declaredTotal.value - net) > 0.01) {
    warnings.push(
      `Il totale dichiarato (${declaredTotal.value.toFixed(2)}) non coincide con la somma dei movimenti (${net.toFixed(2)}).`
    );
  }

  return {
    statement: {
      format: 'card',
      movements,
      openingBalance: null,
      closingBalance: null,
      net,
    },
    warnings,
  };
};

/**
 * Parse a bank statement CSV into movements plus the opening/closing anchors.
 * Never throws on malformed rows: they are skipped and reported in `warnings`.
 */
export const parseBankStatementCsv = (text: string): BankStatementParseResult => {
  const warnings: string[] = [];
  const rawRows = splitCsvRows(text).filter((row) => row.some((cell) => cell.trim() !== ''));

  if (rawRows.length === 0) {
    throw new Error('Il file è vuoto.');
  }
  const header = rawRows[0].map((cell) => cell.trim().toUpperCase());
  if (CARD_HEADER.every((column, index) => header[index] === column)) {
    return parseCardStatement(rawRows);
  }
  if (!rawRows[0][0]?.trim().toUpperCase().startsWith(HEADER_FIRST_COLUMN)) {
    throw new Error(
      "Il file non sembra un estratto conto: manca l'intestazione con DATA CONTABILE."
    );
  }

  const movements: BankStatementRow[] = [];
  let openingBalance: BankStatementBalanceAnchor | null = null;
  let closingBalance: BankStatementBalanceAnchor | null = null;

  rawRows.slice(1).forEach((cells, index) => {
    const line = index + 1;
    const [contabileRaw = '', valutaRaw = '', usciteRaw = '', entrateRaw = '', causaleRaw = '', descrizioneRaw = ''] =
      cells;

    const accountingDate = parseBankDate(contabileRaw);
    const description = descrizioneRaw.trim();
    const kind = detectKind(description);

    if (kind !== 'movement') {
      const amount =
        parseBankAmount(entrateRaw) ?? parseBankAmount(usciteRaw);
      if (accountingDate && amount !== null) {
        const anchor = { date: accountingDate, amount };
        if (kind === 'opening-balance') openingBalance = anchor;
        else closingBalance = anchor;
      } else {
        warnings.push(`Riga ${line}: ancora di saldo senza data o importo valido.`);
      }
      return;
    }

    const uscite = parseBankAmount(usciteRaw);
    const entrate = parseBankAmount(entrateRaw);
    const amount = uscite ?? entrate;

    if (!accountingDate || amount === null) {
      warnings.push(`Riga ${line}: data contabile o importo non validi, riga ignorata.`);
      return;
    }

    const currencyMatch = /Div=([A-Z]{3})/.exec(description);
    const foreignMatch = /Importo in divisa=([\d.,]+)/.exec(description);
    const cardMatch = /Carta\s+x+(\d{4})/.exec(description);

    movements.push({
      line,
      format: 'bank',
      accountingDate,
      valueDate: parseBankDate(valutaRaw),
      amount,
      causale: causaleRaw.trim(),
      description,
      merchant: extractMerchant(description),
      operationDateTime: extractOperationDateTime(description),
      currency: currencyMatch ? currencyMatch[1] : null,
      foreignAmount: foreignMatch ? parseLooseNumber(foreignMatch[1]) : null,
      cardLast4: cardMatch ? cardMatch[1] : null,
    });
  });

  if (movements.length === 0) {
    warnings.push('Nessun movimento trovato nel file.');
  }

  return {
    statement: {
      format: 'bank',
      movements,
      openingBalance,
      closingBalance,
      net: getStatementNet(movements),
    },
    warnings,
  };
};

/**
 * Sum of the statement movements: expected to equal
 * `closingBalance − openingBalance` when both anchors are present.
 */
export const getStatementNet = (rows: BankStatementRow[]): number =>
  Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
