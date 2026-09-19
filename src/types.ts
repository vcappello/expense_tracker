// Database Models
export interface Account {
  id: string;
  name: string;
  initialBalance: number;
  isPreferred: boolean;
  isCoinAccount: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseType {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  date: Date;
  time: string; // HH:mm:ss format
  amount: number;
  expenseTypeId: string;
  accountId: string;
  routingPairId: string | null;
  notes: string; // optional free-text annotation (default '')
  location: string; // optional free-text place name (default '')
  reimbursable: boolean; // the expense will be reimbursed (e.g. with the salary, default false)
  recurringId: string | null; // RecurringExpense that generated this expense (null for normal expenses)
  recurringPeriod: string | null; // period key consumed by the confirmation (see utils/recurrence.ts)
  createdAt: Date;
  updatedAt: Date;
}

export interface Cashflow {
  id: string;
  date: Date;
  time: string; // HH:mm:ss format
  amount: number;
  accountId: string;
  routingAccountId: string | null;
  routingPairId: string | null;
  isSalary: boolean; // this income is the salary (default false)
  recurringId: string | null; // RecurringExpense that generated this cashflow (null for normal cashflows)
  recurringPeriod: string | null; // period key consumed by the confirmation (see utils/recurrence.ts)
  createdAt: Date;
  updatedAt: Date;
}

// Movement is union type for list display
export type Movement = 
  | (Expense & { type: 'expense' })
  | (Cashflow & { type: 'cashflow' });

// Recurring expenses (see spec.md → "Recurring expenses")
// `once` = one-off scheduled movement (a single planned date, no repetition).
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'once';

/** What a recurring template produces when confirmed. */
export type RecurringKind = 'expense' | 'income';

/**
 * A recurring template. It is not a movement: it only describes the movement to
 * propose, period by period, as an "expected" (not yet confirmed) movement. The
 * confirmation creates a normal Expense (kind = 'expense') or a normal Cashflow
 * (kind = 'income') (see AppContext).
 * See spec.md → "Recurring expenses" and "Recurring / scheduled income".
 */
export interface RecurringExpense {
  id: string;
  name: string;
  kind: RecurringKind; // 'expense' (default) or 'income'
  frequency: RecurrenceFrequency;
  amount: number; // default amount, editable at every confirmation
  expenseTypeId: string; // category (expense templates only)
  accountId: string; // expense: paying account; income: credit account
  startDate: Date; // reference day (weekday for weekly, day of month for monthly, planned date for once)
  active: boolean; // false = paused, no occurrence is proposed
  notes: string;
  location: string;
  reimbursable: boolean; // expense templates only
  isSalary: boolean; // income templates only: the income is the salary (default false)
  // State of the last handled period (only the current period is ever proposed)
  lastConfirmedPeriod: string | null; // period key of the last confirmation
  lastConfirmedExpenseId: string | null; // Expense created by that confirmation
  skippedPeriod: string | null; // last period skipped with "Salta questa"
  createdAt: Date;
  updatedAt: Date;
}

// Filter Types
export type DateRange = 'current-month' | 'previous-month' | 'current-year' | 'previous-year' | 'last-5-years' | 'all';

export interface AnalyticsFilters {
  dateRange: DateRange;
  expenseTypeIds: string[];
  accountIds: string[];
}

export interface MovementFilters {
  dateRange: DateRange;
}

// Analytics Summary
export interface AnalyticsSummary {
  totalExpenses: number;
  totalCashflow: number;
  netBalance: number;
  averageDailyExpense: number;
  topCategories: TopCategory[];
}

export interface TopCategory {
  expenseTypeId: string;
  name: string;
  total: number;
}
