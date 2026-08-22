import { Cashflow } from '../types';

/**
 * Build a stable key that identifies a cashflow as part of a routing transfer:
 * date + time + absolute amount.
 */
const routingKey = (c: Cashflow): string =>
  `${new Date(c.date).getTime()}|${c.time || ''}|${Math.abs(c.amount)}`;

/**
 * True if the cashflow is a routing movement: either the receiving side
 * (routingAccountId set) or the negative counterpart of a routing transfer
 * (same date/time/absolute amount of a routing cashflow).
 */
export const isRoutingCashflow = (
  cashflow: Cashflow,
  allCashflows: Cashflow[]
): boolean => {
  if (cashflow.routingAccountId) return true;
  if (cashflow.amount >= 0) return false;
  return allCashflows.some(
    (other) =>
      other.routingAccountId &&
      Math.abs(other.amount) === Math.abs(cashflow.amount) &&
      new Date(other.date).getTime() === new Date(cashflow.date).getTime() &&
      (other.time || '') === (cashflow.time || '')
  );
};

/**
 * Ids of the negative counterparts of routing transfers. In lists only one
 * movement per routing transfer is displayed (the receiving one, yellow);
 * these negative counterparts must be hidden.
 */
export const routingCounterpartIds = (allCashflows: Cashflow[]): Set<string> => {
  const routingKeys = new Set(
    allCashflows
      .filter((c) => c.routingAccountId)
      .map((c) => routingKey(c))
  );

  return new Set(
    allCashflows
      .filter((c) => !c.routingAccountId && c.amount < 0 && routingKeys.has(routingKey(c)))
      .map((c) => c.id)
  );
};
