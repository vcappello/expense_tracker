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

/**
 * Default account of the primary selector in the Expense/Cashflow/Recurring
 * forms: the first preferred normal account, otherwise the first normal
 * account, otherwise the first account (database with stashes only). A
 * preferred stash is the default of the secondary selector only, so it never
 * becomes the default primary account.
 */
export const getDefaultPrimaryAccount = (
  accounts: Account[]
): Account | undefined => {
  const ordered = sortAccountsPreferred(accounts);
  return (
    ordered.find((account) => account.isPreferred && !account.isCoinAccount) ??
    ordered.find((account) => !account.isCoinAccount) ??
    ordered[0]
  );
};
