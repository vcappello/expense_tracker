import { Cashflow, Expense } from '../types';

export interface ReimbursableSummary {
  total: number;
  count: number;
}

/**
 * Find the "previous salary": the most recent Cashflow marked as salary
 * (`isSalary = true`) with a date strictly before `referenceDate`. Returns
 * `undefined` when none exists (in that case every reimbursable expense is
 * considered).
 *
 * Window-only approach: no "reimbursed" state is stored on the expenses, so
 * editing/deleting/unchecking a salary just changes the reference used by the
 * following ones; nothing else needs to be reconciled.
 */
export const findPreviousSalary = (
  cashflows: Cashflow[],
  referenceDate: Date
): Cashflow | undefined => {
  const reference = new Date(referenceDate).getTime();
  let previous: Cashflow | undefined;
  for (const c of cashflows) {
    if (!c.isSalary) continue;
    const t = new Date(c.date).getTime();
    if (t < reference && (!previous || t > new Date(previous.date).getTime())) {
      previous = c;
    }
  }
  return previous;
};

/**
 * Reimbursable expenses in the current salary window. With no earlier salary,
 * all reimbursable expenses are included.
 */
export const getOutstandingReimbursableExpenses = (
  expenses: Expense[],
  cashflows: Cashflow[],
  referenceDate: Date
): Expense[] => {
  const previous = findPreviousSalary(cashflows, referenceDate);
  const from = previous ? new Date(previous.date).getTime() : -Infinity;
  return expenses.filter(
    (expense) =>
      expense.reimbursable && new Date(expense.date).getTime() > from
  );
};

/**
 * Total (and count) of the reimbursable expenses to be claimed with the next
 * salary: all Expenses with `reimbursable = true` whose date is later than the
 * date of the previous salary (if any). With no previous salary every
 * reimbursable Expense is considered. Informational only — it does not change
 * how the expenses behave in Analytics or in the account balances.
 */
export const getReimbursableSummary = (
  expenses: Expense[],
  cashflows: Cashflow[],
  referenceDate: Date
): ReimbursableSummary => {
  const outstanding = getOutstandingReimbursableExpenses(
    expenses,
    cashflows,
    referenceDate
  );
  return {
    total: outstanding.reduce((sum, expense) => sum + expense.amount, 0),
    count: outstanding.length,
  };
};
