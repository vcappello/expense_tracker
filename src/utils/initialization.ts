import { Account, ExpenseType } from '../types';
import * as db from '../db/database';

// Cache the initialization promise so concurrent calls (e.g. React StrictMode
// double-mount in dev) share the same run instead of racing each other and
// causing ConstraintError: Key already exists.
let initializationPromise: Promise<void> | null = null;

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
    }
  } catch (error) {
    console.error('❌ Failed to initialize default data:', error);
  }
};
