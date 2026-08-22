import { Account } from '../types';

/**
 * Sort accounts so that preferred accounts (isPreferred) come first,
 * then alphabetically by name. Used in the account dropdowns during
 * Expense/Cashflow insertion and in the account lists.
 */
export const sortAccountsPreferred = (accounts: Account[]): Account[] =>
  [...accounts].sort((a, b) => {
    if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
