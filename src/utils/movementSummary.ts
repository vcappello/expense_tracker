import { Cashflow, Expense } from '../types';
import { isRoutingCashflow } from './routing';

export interface MovementMonthSummary {
  month: Date;
  totalCashflow: number;
  totalExpenses: number;
  netBalance: number;
}

export const getLatestMovementMonthSummary = (
  expenses: Expense[],
  cashflows: Cashflow[],
  beforeDate: Date
): MovementMonthSummary | null => {
  const summaries = new Map<
    number,
    { month: Date; totalCashflow: number; totalExpenses: number }
  >();
  const beforeTime = beforeDate.getTime();

  const getSummary = (date: Date) => {
    if (date.getTime() >= beforeTime) return null;
    const month = new Date(date.getFullYear(), date.getMonth(), 1);
    const key = month.getFullYear() * 12 + month.getMonth();
    let summary = summaries.get(key);
    if (!summary) {
      summary = { month, totalCashflow: 0, totalExpenses: 0 };
      summaries.set(key, summary);
    }
    return summary;
  };

  for (const expense of expenses) {
    const summary = getSummary(expense.date);
    if (summary) summary.totalExpenses += expense.amount;
  }

  for (const cashflow of cashflows) {
    if (isRoutingCashflow(cashflow, cashflows)) continue;
    const summary = getSummary(cashflow.date);
    if (summary) summary.totalCashflow += cashflow.amount;
  }

  const latest = [...summaries.values()].sort(
    (a, b) => b.month.getTime() - a.month.getTime()
  )[0];

  if (!latest) return null;
  return { ...latest, netBalance: latest.totalCashflow - latest.totalExpenses };
};
