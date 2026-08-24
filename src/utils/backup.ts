import * as db from '../db/database';
import { Account, Cashflow, Expense, ExpenseType } from '../types';

const BACKUP_APP = 'expense-tracker-ai';
const BACKUP_VERSION = 1;

/**
 * Content of a backup file. Dates are serialized as ISO strings by
 * `JSON.stringify` (they are parsed back to `Date` objects on import).
 */
export interface BackupData {
  app: string;
  version: number;
  exportedAt: string;
  accounts: Account[];
  expenseTypes: ExpenseType[];
  expenses: Expense[];
  cashflows: Cashflow[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toDate = (value: unknown): Date =>
  value instanceof Date ? value : new Date(value as string);

/**
 * Export the whole database (all 4 stores) to a downloadable JSON file.
 * Origin-independent: it can be re-imported on any origin (e.g. after
 * switching the server to HTTPS). See `spec.md` → Backup / Ripristino.
 */
export const exportDatabase = async (): Promise<void> => {
  const [accounts, expenseTypes, expenses, cashflows] = await Promise.all([
    db.getAccounts(),
    db.getExpenseTypes(),
    db.getExpenses(),
    db.getCashflows(),
  ]);

  const data: BackupData = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    accounts,
    expenseTypes,
    expenses,
    cashflows,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `expense-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const normalizeAccount = (raw: Record<string, unknown>): Account => ({
  id: String(raw.id),
  name: String(raw.name),
  initialBalance: typeof raw.initialBalance === 'number' ? raw.initialBalance : 0,
  isPreferred: raw.isPreferred === true,
  createdAt: toDate(raw.createdAt),
  updatedAt: toDate(raw.updatedAt),
});

const normalizeExpenseType = (raw: Record<string, unknown>): ExpenseType => ({
  id: String(raw.id),
  name: String(raw.name),
  parentId: typeof raw.parentId === 'string' ? raw.parentId : null,
  createdAt: toDate(raw.createdAt),
  updatedAt: toDate(raw.updatedAt),
});

const normalizeExpense = (raw: Record<string, unknown>): Expense => ({
  id: String(raw.id),
  date: toDate(raw.date),
  time: String(raw.time ?? ''),
  amount: Number(raw.amount),
  expenseTypeId: String(raw.expenseTypeId),
  accountId: String(raw.accountId),
  routingPairId: typeof raw.routingPairId === 'string' ? raw.routingPairId : null,
  createdAt: toDate(raw.createdAt),
  updatedAt: toDate(raw.updatedAt),
});

const normalizeCashflow = (raw: Record<string, unknown>): Cashflow => ({
  id: String(raw.id),
  date: toDate(raw.date),
  time: String(raw.time ?? ''),
  amount: Number(raw.amount),
  accountId: String(raw.accountId),
  routingAccountId: typeof raw.routingAccountId === 'string' ? raw.routingAccountId : null,
  routingPairId: typeof raw.routingPairId === 'string' ? raw.routingPairId : null,
  createdAt: toDate(raw.createdAt),
  updatedAt: toDate(raw.updatedAt),
});

/**
 * Read and validate a backup file selected by the user. Converts date strings
 * back to `Date` objects and normalizes optional fields (`initialBalance`,
 * `isPreferred`, `parentId`, `routingAccountId`). Throws an Error with an
 * Italian message when the file is not a valid backup.
 */
export const readBackupFile = async (file: File): Promise<BackupData> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Il file selezionato non è un backup valido.');
  }

  if (
    !isRecord(parsed) ||
    parsed.app !== BACKUP_APP ||
    !Array.isArray(parsed.accounts) ||
    !Array.isArray(parsed.expenseTypes) ||
    !Array.isArray(parsed.expenses) ||
    !Array.isArray(parsed.cashflows)
  ) {
    throw new Error('Il file selezionato non è un backup valido.');
  }

  return {
    app: String(parsed.app),
    version: typeof parsed.version === 'number' ? parsed.version : 1,
    exportedAt: String(parsed.exportedAt ?? ''),
    accounts: parsed.accounts.filter(isRecord).map(normalizeAccount),
    expenseTypes: parsed.expenseTypes.filter(isRecord).map(normalizeExpenseType),
    expenses: parsed.expenses.filter(isRecord).map(normalizeExpense),
    cashflows: parsed.cashflows.filter(isRecord).map(normalizeCashflow),
  };
};
