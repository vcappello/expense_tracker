import {
  Account,
  AccountBalanceAdjustment,
  Cashflow,
  Expense,
} from '../types';

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

  const cashflowTotal = cashflows
    .filter((cashflow) => new Date(cashflow.date).getTime() <= endTime)
    .reduce((sum, cashflow) => sum + cashflow.amount, 0);
  const expenseTotal = expenses
    .filter((expense) => new Date(expense.date).getTime() <= endTime)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const adjustmentTotal = adjustments
    .filter(
      (adjustment) =>
        adjustment.id !== excludedAdjustmentId &&
        new Date(adjustment.date).getTime() <= endTime
    )
    .reduce((sum, adjustment) => sum + adjustment.amount, 0);

  return account.initialBalance + cashflowTotal - expenseTotal + adjustmentTotal;
};
