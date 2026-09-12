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
  createdAt: Date;
  updatedAt: Date;
}

// Movement is union type for list display
export type Movement = 
  | (Expense & { type: 'expense' })
  | (Cashflow & { type: 'cashflow' });

// Recurring expenses (see spec.md → "Recurring expenses")
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * A recurring expense template. It is not a movement: it only describes the
 * expense to propose, period by period, as an "expected" (not yet confirmed)
 * expense. The confirmation creates a normal Expense (see AppContext).
 */
export interface RecurringExpense {
  id: string;
  name: string;
  frequency: RecurrenceFrequency;
  amount: number; // default amount, editable at every confirmation
  expenseTypeId: string;
  accountId: string;
  startDate: Date; // reference day (weekday for weekly, day of month for monthly, ...)
  active: boolean; // false = paused, no occurrence is proposed
  notes: string;
  location: string;
  reimbursable: boolean;
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
