import { Cashflow } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface CoinSplitCashflowParams {
  pairId: string;
  date: Date;
  time: string;
  coinsAmount: number;
  mainAccountId: string;
  coinsAccountId: string;
}

/**
 * Build the 3 Cashflow records of a coin-split expense group, all sharing the
 * same `pairId`:
 * - the internal income on the coins account (+coinsAmount);
 * - the negative routing leg on the coins account (−coinsAmount);
 * - the positive receiving leg on the main account (+coinsAmount, source =
 *   the coins account).
 *
 * The internal income and the negative leg cancel out, so the coins account
 * always stays at 0 (untracked coin stash — see spec "coin split").
 */
export const buildCoinSplitCashflows = ({
  pairId,
  date,
  time,
  coinsAmount,
  mainAccountId,
  coinsAccountId,
}: CoinSplitCashflowParams): Cashflow[] => {
  const createdAt = new Date();
  const updatedAt = new Date();
  return [
    {
      id: uuidv4(),
      date,
      time,
      amount: coinsAmount,
      accountId: coinsAccountId,
      routingAccountId: null,
      routingPairId: pairId,
      createdAt,
      updatedAt,
    },
    {
      id: uuidv4(),
      date,
      time,
      amount: -coinsAmount,
      accountId: coinsAccountId,
      routingAccountId: null,
      routingPairId: pairId,
      createdAt,
      updatedAt,
    },
    {
      id: uuidv4(),
      date,
      time,
      amount: coinsAmount,
      accountId: mainAccountId,
      routingAccountId: coinsAccountId,
      routingPairId: pairId,
      createdAt,
      updatedAt,
    },
  ];
};
