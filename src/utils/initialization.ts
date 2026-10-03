import { Account, ExpenseType } from '../types';
import * as db from '../db/database';

// Cache the initialization promise so concurrent calls (e.g. React StrictMode
// double-mount in dev) share the same run instead of racing each other and
// causing ConstraintError: Key already exists.
let initializationPromise: Promise<void> | null = null;

/**
 * Default untracked stash account ("Coins"): always available as the
 * secondary-account source of an Expense, preferred so that it is the default
 * of that selector. It is never a duplicating account: the backfill below only
 * creates it when the database has no stash and no account with the same name.
 */
const buildDefaultCoinsAccount = (): Account => ({
  id: 'acc-coins',
  name: 'Coins',
  initialBalance: 0,
  isPreferred: true,
  isCoinAccount: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * Initialize default data if the database is empty.
 * Idempotent and concurrency-safe: multiple calls return the same promise.
 */
export const initializeDefaultData = (): Promise<void> => {
  if (!initializationPromise) {
    initializationPromise = doInitializeDefaultData();
  }
  return initializationPromise;
};

const doInitializeDefaultData = async () => {
  try {
    const accounts = await db.getAccounts();

    // Only initialize if no accounts exist
    if (accounts.length === 0) {
      // Create default accounts
      const cashAccount: Account = {
        id: 'acc-cash',
        name: 'Cash',
        initialBalance: 0,
        isPreferred: false,
        isCoinAccount: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const bankAccount: Account = {
        id: 'acc-bank',
        name: 'Bank account',
        initialBalance: 0,
        isPreferred: true,
        isCoinAccount: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.createAccount(cashAccount);
      await db.createAccount(bankAccount);
      await db.createAccount(buildDefaultCoinsAccount());

      // Create default expense types
      const defaultTypes: ExpenseType[] = [
        {
          id: 'et-dinner',
          name: 'Dinner',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'et-shopping',
          name: 'Shopping',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'et-fuel',
          name: 'Fuel',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'et-tolls',
          name: 'Tolls',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      for (const type of defaultTypes) {
        await db.createExpenseType(type);
      }

      console.log('✅ Default data initialized');
      return;
    }

    // Databases created before the untracked stash (or where it was deleted)
    // would have an empty "Conto secondario" selector: provide the default
    // Coins account, without duplicating an account with the same name and
    // without changing the type of the existing accounts.
    const hasStash = accounts.some((account) => account.isCoinAccount === true);
    const hasCoinsName = accounts.some((account) => account.name === 'Coins');
    if (!hasStash && !hasCoinsName) {
      await db.createAccount(buildDefaultCoinsAccount());
      console.log('✅ Default coins account initialized');
      return;
    }

    // A single stash is always the default of the secondary selector, but
    // marking it as preferred (★) keeps that default stable when other stashes
    // are created later (otherwise the first one by name would win). With
    // several stashes and no preferred one the choice is left to the user.
    const stashes = accounts.filter((account) => account.isCoinAccount === true);
    if (stashes.length === 1 && stashes[0].isPreferred !== true) {
      await db.updateAccount({
        ...stashes[0],
        isPreferred: true,
        updatedAt: new Date(),
      });
      console.log('✅ Default stash marked as preferred');
    }
  } catch (error) {
    console.error('❌ Failed to initialize default data:', error);
  }
};
