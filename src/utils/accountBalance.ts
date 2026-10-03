import {
  Account,
  AccountBalanceAdjustment,
  Cashflow,
  Expense,
} from '../types';

/**
 * Balance of an account: initialBalance + cashflows − expenses + adjustments.
 * The three arrays must already be scoped to the account. Expenses and
 * cashflows assigned to an untracked stash do not change its balance, so they
 * are ignored for a stash account (initial balance and adjustments still apply).
 */
export const getAccountBalance = (
  account: Account,
  expenses: Expense[],
  cashflows: Cashflow[],
  adjustments: AccountBalanceAdjustment[]
): number => {
  const cashflowTotal = account.isCoinAccount
    ? 0
    : cashflows.reduce((sum, cashflow) => sum + cashflow.amount, 0);
  const expenseTotal = account.isCoinAccount
    ? 0
    : expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const adjustmentTotal = adjustments.reduce(
    (sum, adjustment) => sum + adjustment.amount,
    0
  );

  return (
    (account.initialBalance || 0) + cashflowTotal - expenseTotal + adjustmentTotal
  );
};

export const getAccountBalanceAtDate = (
  account: Account,
  expenses: Expense[],
  cashflows: Cashflow[],
  adjustments: AccountBalanceAdjustment[],
  date: Date,
  excludedAdjustmentId?: string
): number => {
  const endOfDate = new Date(date);
  endOfDate.setHours(23, 59, 59, 999);
  const endTime = endOfDate.getTime();

  return getAccountBalance(
    account,
    expenses.filter((expense) => new Date(expense.date).getTime() <= endTime),
    cashflows.filter((cashflow) => new Date(cashflow.date).getTime() <= endTime),
    adjustments.filter(
      (adjustment) =>
        adjustment.id !== excludedAdjustmentId &&
        new Date(adjustment.date).getTime() <= endTime
    )
  );
};
