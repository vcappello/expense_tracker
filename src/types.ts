// Database Models
export interface Account {
  id: string;
  name: string;
  initialBalance: number;
  isPreferred: boolean;
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
  createdAt: Date;
  updatedAt: Date;
}

// Movement is union type for list display
export type Movement = 
  | (Expense & { type: 'expense' })
  | (Cashflow & { type: 'cashflow' });

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
