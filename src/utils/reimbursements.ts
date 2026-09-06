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
  const previous = findPreviousSalary(cashflows, referenceDate);
  const from = previous ? new Date(previous.date).getTime() : -Infinity;
  let total = 0;
  let count = 0;
  for (const e of expenses) {
    if (!e.reimbursable) continue;
    const t = new Date(e.date).getTime();
    // strictly later than the previous salary (expenses on the same day as the
    // salary belong to the previous period)
    if (t <= from) continue;
    total += e.amount;
    count += 1;
  }
  return { total, count };
};
