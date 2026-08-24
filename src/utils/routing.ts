import { Cashflow } from '../types';

/**
 * Build a stable key that identifies a cashflow as part of a routing transfer:
 * date + time + absolute amount.
 */
const routingKey = (c: Cashflow): string =>
  `${new Date(c.date).getTime()}|${c.time || ''}|${Math.abs(c.amount)}`;

/**
 * True if the cashflow is a routing movement: either the receiving side
 * (routingAccountId set) or the negative counterpart of a routing transfer.
 *
 * With the explicit `routingPairId` link (both legs of a routing pair share it)
 * the detection is exact: a leg is a routing when it has a `routingAccountId`
 * (the positive receiving side) or a negative amount. A positive Cashflow with
 * a `routingPairId` but no `routingAccountId` is the *internal income* of a
 * coin-split expense (see spec), so it is NOT a routing movement.
 *
 * Legacy records without a link fall back to the date/time/amount heuristic.
 */
export const isRoutingCashflow = (
  cashflow: Cashflow,
  allCashflows: Cashflow[]
): boolean => {
  if (cashflow.routingAccountId) return true;
  if (cashflow.routingPairId) return cashflow.amount < 0;
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
 * Ids of the cashflows that must be hidden in the movement lists. In lists only
 * one movement per routing transfer is displayed (the receiving one, yellow):
 * - the negative counterpart(s) on the routing account;
 * - for coin-split expenses, also the internal income on the second account.
 *
 * Records linked by `routingPairId` are detected exactly; legacy records
 * without a link fall back to the date/time/amount heuristic.
 */
export const routingCounterpartIds = (allCashflows: Cashflow[]): Set<string> => {
  const ids = new Set<string>();

  // Linked records (routingPairId): hide everything except the receiving leg
  // (the one with routingAccountId set, shown in yellow).
  const byPair = new Map<string, Cashflow[]>();
  for (const c of allCashflows) {
    if (c.routingPairId) {
      const list = byPair.get(c.routingPairId);
      if (list) list.push(c);
      else byPair.set(c.routingPairId, [c]);
    }
  }
  for (const group of byPair.values()) {
    for (const c of group) {
      if (!c.routingAccountId) ids.add(c.id);
    }
  }

  // Legacy fallback: negative cashflows without a link that match the
  // date/time/amount of a routing (receiving) movement.
  const routingKeys = new Set(
    allCashflows.filter((c) => c.routingAccountId).map((c) => routingKey(c))
  );
  for (const c of allCashflows) {
    if (!c.routingPairId && c.amount < 0 && routingKeys.has(routingKey(c))) {
      ids.add(c.id);
    }
  }

  return ids;
};
