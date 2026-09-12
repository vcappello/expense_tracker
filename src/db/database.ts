import {
  Account,
  Expense,
  ExpenseType,
  Cashflow,
  RecurringExpense,
} from '../types';

const DB_NAME = 'expense-tracker-db';
// v2: added the `recurringExpenses` store (recurring expense templates).
// The upgrade only creates the missing stores: existing data is preserved.
const DB_VERSION = 2;

const STORES = {
  ACCOUNTS: 'accounts',
  EXPENSE_TYPES: 'expenseTypes',
  EXPENSES: 'expenses',
  CASHFLOWS: 'cashflows',
  RECURRING_EXPENSES: 'recurringExpenses',
};

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB database
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    // Another tab still holds the previous version: the upgrade is blocked.
    // Fail with a clear message instead of hanging (the user has to close the
    // other tabs and reload).
    request.onblocked = () =>
      reject(
        new Error(
          "Aggiornamento del database bloccato: chiudi le altre schede dell'app aperte e ricarica la pagina."
        )
      );

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create stores if they don't exist
      if (!database.objectStoreNames.contains(STORES.ACCOUNTS)) {
        database.createObjectStore(STORES.ACCOUNTS, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(STORES.EXPENSE_TYPES)) {
        const expenseStore = database.createObjectStore(STORES.EXPENSE_TYPES, {
          keyPath: 'id',
        });
        expenseStore.createIndex('parentId', 'parentId', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.EXPENSES)) {
        const expenseStore = database.createObjectStore(STORES.EXPENSES, {
          keyPath: 'id',
        });
        expenseStore.createIndex('date', 'date', { unique: false });
        expenseStore.createIndex('accountId', 'accountId', { unique: false });
        expenseStore.createIndex('expenseTypeId', 'expenseTypeId', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.CASHFLOWS)) {
        const cashflowStore = database.createObjectStore(STORES.CASHFLOWS, {
          keyPath: 'id',
        });
        cashflowStore.createIndex('date', 'date', { unique: false });
        cashflowStore.createIndex('accountId', 'accountId', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.RECURRING_EXPENSES)) {
        const recurringStore = database.createObjectStore(
          STORES.RECURRING_EXPENSES,
          { keyPath: 'id' }
        );
        recurringStore.createIndex('accountId', 'accountId', { unique: false });
        recurringStore.createIndex('expenseTypeId', 'expenseTypeId', {
          unique: false,
        });
      }
    };
  });
};

/**
 * Close database connection
 */
export const closeDB = () => {
  if (db) {
    db.close();
    db = null;
  }
};

/**
 * Normalize legacy Expense records that predate the `routingPairId` link
 * (missing field → null), the `notes`/`location` free-text fields
 * (missing field → '') or the `reimbursable` flag (missing → false). Keeps
 * existing data backward compatible.
 */
const normalizeExpense = (e: Expense): Expense => ({
  ...e,
  routingPairId: e.routingPairId ?? null,
  notes: e.notes ?? '',
  location: e.location ?? '',
  reimbursable: e.reimbursable === true,
  recurringId: e.recurringId ?? null,
  recurringPeriod: e.recurringPeriod ?? null,
});

/**
 * Normalize legacy RecurringExpense records (fields added after the first
 * release of the feature): missing text fields default to '', missing booleans
 * to false, missing state fields to null.
 */
const normalizeRecurringExpense = (r: RecurringExpense): RecurringExpense => ({
  ...r,
  amount: typeof r.amount === 'number' ? r.amount : 0,
  active: r.active !== false,
  notes: r.notes ?? '',
  location: r.location ?? '',
  reimbursable: r.reimbursable === true,
  lastConfirmedPeriod: r.lastConfirmedPeriod ?? null,
  lastConfirmedExpenseId: r.lastConfirmedExpenseId ?? null,
  skippedPeriod: r.skippedPeriod ?? null,
});

/**
 * Normalize legacy Cashflow records that predate the `routingPairId` link
 * (missing field → null) or the `isSalary` flag (missing → false). Keeps
 * existing data backward compatible.
 */
const normalizeCashflow = (c: Cashflow): Cashflow => ({
  ...c,
  routingPairId: c.routingPairId ?? null,
  isSalary: c.isSalary === true,
});

// ============ ACCOUNT OPERATIONS ============

export const createAccount = async (account: Account): Promise<Account> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ACCOUNTS], 'readwrite');
    const store = transaction.objectStore(STORES.ACCOUNTS);
    const request = store.add(account);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(account);
  });
};

export const getAccounts = async (): Promise<Account[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ACCOUNTS], 'readonly');
    const store = transaction.objectStore(STORES.ACCOUNTS);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const accounts = (request.result as Account[]).map((a) => ({
        ...a,
        initialBalance: typeof a.initialBalance === 'number' ? a.initialBalance : 0,
        isPreferred: a.isPreferred === true,
        isCoinAccount: a.isCoinAccount === true,
      }));
      resolve(accounts);
    };
  });
};

export const getAccount = async (id: string): Promise<Account | undefined> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ACCOUNTS], 'readonly');
    const store = transaction.objectStore(STORES.ACCOUNTS);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const account = request.result as Account | undefined;
      if (!account) {
        resolve(undefined);
        return;
      }
      resolve({
        ...account,
        initialBalance: typeof account.initialBalance === 'number' ? account.initialBalance : 0,
        isPreferred: account.isPreferred === true,
        isCoinAccount: account.isCoinAccount === true,
      });
    };
  });
};

export const updateAccount = async (account: Account): Promise<Account> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ACCOUNTS], 'readwrite');
    const store = transaction.objectStore(STORES.ACCOUNTS);
    const request = store.put(account);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(account);
  });
};

export const deleteAccount = async (id: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ACCOUNTS], 'readwrite');
    const store = transaction.objectStore(STORES.ACCOUNTS);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// ============ EXPENSE TYPE OPERATIONS ============

export const createExpenseType = async (
  expenseType: ExpenseType
): Promise<ExpenseType> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSE_TYPES], 'readwrite');
    const store = transaction.objectStore(STORES.EXPENSE_TYPES);
    const request = store.add(expenseType);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(expenseType);
  });
};

export const getExpenseTypes = async (): Promise<ExpenseType[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSE_TYPES], 'readonly');
    const store = transaction.objectStore(STORES.EXPENSE_TYPES);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const getExpenseType = async (id: string): Promise<ExpenseType | undefined> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSE_TYPES], 'readonly');
    const store = transaction.objectStore(STORES.EXPENSE_TYPES);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const updateExpenseType = async (
  expenseType: ExpenseType
): Promise<ExpenseType> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSE_TYPES], 'readwrite');
    const store = transaction.objectStore(STORES.EXPENSE_TYPES);
    const request = store.put(expenseType);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(expenseType);
  });
};

export const deleteExpenseType = async (id: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSE_TYPES], 'readwrite');
    const store = transaction.objectStore(STORES.EXPENSE_TYPES);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// ============ EXPENSE OPERATIONS ============

export const createExpense = async (expense: Expense): Promise<Expense> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSES], 'readwrite');
    const store = transaction.objectStore(STORES.EXPENSES);
    const request = store.add(expense);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(expense);
  });
};

export const getExpenses = async (): Promise<Expense[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSES], 'readonly');
    const store = transaction.objectStore(STORES.EXPENSES);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.map(normalizeExpense));
  });
};

export const getExpense = async (id: string): Promise<Expense | undefined> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSES], 'readonly');
    const store = transaction.objectStore(STORES.EXPENSES);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(request.result ? normalizeExpense(request.result) : undefined);
  });
};

export const getExpensesByDateRange = async (
  startDate: Date,
  endDate: Date
): Promise<Expense[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSES], 'readonly');
    const store = transaction.objectStore(STORES.EXPENSES);
    const index = store.index('date');
    const range = IDBKeyRange.bound(startDate, endDate);
    const request = index.getAll(range);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.map(normalizeExpense));
  });
};

export const getExpensesByType = async (expenseTypeId: string): Promise<Expense[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSES], 'readonly');
    const store = transaction.objectStore(STORES.EXPENSES);
    const index = store.index('expenseTypeId');
    const request = index.getAll(expenseTypeId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.map(normalizeExpense));
  });
};

export const getExpensesByAccount = async (accountId: string): Promise<Expense[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSES], 'readonly');
    const store = transaction.objectStore(STORES.EXPENSES);
    const index = store.index('accountId');
    const request = index.getAll(accountId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.map(normalizeExpense));
  });
};

export const updateExpense = async (expense: Expense): Promise<Expense> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSES], 'readwrite');
    const store = transaction.objectStore(STORES.EXPENSES);
    const request = store.put(expense);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(expense);
  });
};

export const deleteExpense = async (id: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.EXPENSES], 'readwrite');
    const store = transaction.objectStore(STORES.EXPENSES);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// ============ CASHFLOW OPERATIONS ============

export const createCashflow = async (cashflow: Cashflow): Promise<Cashflow> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CASHFLOWS], 'readwrite');
    const store = transaction.objectStore(STORES.CASHFLOWS);
    const request = store.add(cashflow);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(cashflow);
  });
};

export const getCashflows = async (): Promise<Cashflow[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CASHFLOWS], 'readonly');
    const store = transaction.objectStore(STORES.CASHFLOWS);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.map(normalizeCashflow));
  });
};

export const getCashflow = async (id: string): Promise<Cashflow | undefined> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CASHFLOWS], 'readonly');
    const store = transaction.objectStore(STORES.CASHFLOWS);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(request.result ? normalizeCashflow(request.result) : undefined);
  });
};

export const getCashflowsByDateRange = async (
  startDate: Date,
  endDate: Date
): Promise<Cashflow[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CASHFLOWS], 'readonly');
    const store = transaction.objectStore(STORES.CASHFLOWS);
    const index = store.index('date');
    const range = IDBKeyRange.bound(startDate, endDate);
    const request = index.getAll(range);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.map(normalizeCashflow));
  });
};

export const getCashflowsByAccount = async (accountId: string): Promise<Cashflow[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CASHFLOWS], 'readonly');
    const store = transaction.objectStore(STORES.CASHFLOWS);
    const index = store.index('accountId');
    const request = index.getAll(accountId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.map(normalizeCashflow));
  });
};

export const updateCashflow = async (cashflow: Cashflow): Promise<Cashflow> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CASHFLOWS], 'readwrite');
    const store = transaction.objectStore(STORES.CASHFLOWS);
    const request = store.put(cashflow);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(cashflow);
  });
};

export const deleteCashflow = async (id: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CASHFLOWS], 'readwrite');
    const store = transaction.objectStore(STORES.CASHFLOWS);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// ============ BULK DELETE (cascade) ============

/**
 * Delete all records in a store matching an indexed key via cursor.
 */
const deleteAllByIndex = (
  storeName: string,
  indexName: string,
  key: string
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    const database = await initDB();
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.openCursor(IDBKeyRange.only(key));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
  });
};

/**
 * Delete all expenses that belong to a given ExpenseType.
 */
export const deleteExpensesByType = (expenseTypeId: string): Promise<void> => {
  return deleteAllByIndex(STORES.EXPENSES, 'expenseTypeId', expenseTypeId);
};

/**
 * Delete all expenses that belong to a given Account.
 */
export const deleteExpensesByAccount = (accountId: string): Promise<void> => {
  return deleteAllByIndex(STORES.EXPENSES, 'accountId', accountId);
};

/**
 * Delete all cashflows that belong to a given Account.
 */
export const deleteCashflowsByAccount = (accountId: string): Promise<void> => {
  return deleteAllByIndex(STORES.CASHFLOWS, 'accountId', accountId);
};

// ============ RECURRING EXPENSE OPERATIONS ============

export const createRecurringExpense = async (
  recurring: RecurringExpense
): Promise<RecurringExpense> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.RECURRING_EXPENSES],
      'readwrite'
    );
    const store = transaction.objectStore(STORES.RECURRING_EXPENSES);
    const request = store.add(recurring);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(recurring);
  });
};

export const getRecurringExpenses = async (): Promise<RecurringExpense[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.RECURRING_EXPENSES],
      'readonly'
    );
    const store = transaction.objectStore(STORES.RECURRING_EXPENSES);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(request.result.map(normalizeRecurringExpense));
  });
};

export const getRecurringExpense = async (
  id: string
): Promise<RecurringExpense | undefined> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.RECURRING_EXPENSES],
      'readonly'
    );
    const store = transaction.objectStore(STORES.RECURRING_EXPENSES);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(
        request.result ? normalizeRecurringExpense(request.result) : undefined
      );
  });
};

export const updateRecurringExpense = async (
  recurring: RecurringExpense
): Promise<RecurringExpense> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.RECURRING_EXPENSES],
      'readwrite'
    );
    const store = transaction.objectStore(STORES.RECURRING_EXPENSES);
    const request = store.put(recurring);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(recurring);
  });
};

/**
 * Remove the recurring link (`recurringId`/`recurringPeriod`) from every
 * Expense that points to the given template. Used when the template is
 * deleted: the Expenses already created are kept and become normal expenses.
 * Runs in the same transaction of the delete when possible.
 */
const clearRecurringLinksInStore = (
  store: IDBObjectStore,
  templateId: string
): void => {
  const request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const expense = cursor.value as Expense;
    if (expense.recurringId === templateId) {
      cursor.update({ ...expense, recurringId: null, recurringPeriod: null });
    }
    cursor.continue();
  };
};

/**
 * Delete a recurring template. The Expenses already created from it are kept
 * but their recurring link is cleared (they become normal expenses).
 */
export const deleteRecurringExpense = async (id: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.RECURRING_EXPENSES, STORES.EXPENSES],
      'readwrite'
    );

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    clearRecurringLinksInStore(
      transaction.objectStore(STORES.EXPENSES),
      id
    );
    transaction.objectStore(STORES.RECURRING_EXPENSES).delete(id);
  });
};

/**
 * Delete all the recurring templates of a given Account / ExpenseType, clearing
 * the recurring link of the Expenses already created from them. Used by the
 * delete cascades (Account / ExpenseType management).
 */
const deleteRecurringByIndex = async (
  indexName: string,
  key: string
): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.RECURRING_EXPENSES, STORES.EXPENSES],
      'readwrite'
    );

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    const expenseStore = transaction.objectStore(STORES.EXPENSES);
    const index = transaction
      .objectStore(STORES.RECURRING_EXPENSES)
      .index(indexName);
    const request = index.openCursor(IDBKeyRange.only(key));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const recurringId = cursor.value.id as string;
      clearRecurringLinksInStore(expenseStore, recurringId);
      cursor.delete();
      cursor.continue();
    };
  });
};

export const deleteRecurringExpensesByAccount = (accountId: string) =>
  deleteRecurringByIndex('accountId', accountId);

export const deleteRecurringExpensesByType = (expenseTypeId: string) =>
  deleteRecurringByIndex('expenseTypeId', expenseTypeId);

/**
 * Count the recurring templates of an Account / ExpenseType (delete cascade
 * confirmation popup).
 */
export const countRecurringByIndex = async (
  indexName: string,
  key: string
): Promise<number> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.RECURRING_EXPENSES],
      'readonly'
    );
    const index = transaction
      .objectStore(STORES.RECURRING_EXPENSES)
      .index(indexName);
    const request = index.count(IDBKeyRange.only(key));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// ============ COIN-SPLIT EXPENSE GROUP (atomic) ============

/**
 * Atomically create an Expense plus its linked coin-split Cashflows (the
 * internal income on the second account and the routing pair) in a single
 * IndexedDB transaction (all-or-nothing). Used by the "paid partly from a
 * second account (coin split)" feature: all records share the same
 * `routingPairId`. If any insert fails the transaction aborts and no record
 * is persisted.
 */
export const createExpenseGroup = async (
  expense: Expense,
  cashflows: Cashflow[]
): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.EXPENSES, STORES.CASHFLOWS],
      'readwrite'
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    transaction.objectStore(STORES.EXPENSES).add(expense);
    const cashflowStore = transaction.objectStore(STORES.CASHFLOWS);
    cashflows.forEach((c) => cashflowStore.add(c));
  });
};

/**
 * Atomically update an Expense and replace its linked coin-split Cashflows in
 * a single transaction (all-or-nothing): the old linked cashflows are deleted
 * and the new ones are added. Used when editing an Expense paid partly from a
 * second account.
 */
export const updateExpenseGroup = async (
  expense: Expense,
  oldCashflowIds: string[],
  newCashflows: Cashflow[]
): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.EXPENSES, STORES.CASHFLOWS],
      'readwrite'
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    transaction.objectStore(STORES.EXPENSES).put(expense);
    const cashflowStore = transaction.objectStore(STORES.CASHFLOWS);
    oldCashflowIds.forEach((id) => cashflowStore.delete(id));
    newCashflows.forEach((c) => cashflowStore.add(c));
  });
};

/**
 * Atomically delete an Expense and its linked coin-split Cashflows in a single
 * transaction (all-or-nothing).
 */
export const deleteExpenseGroup = async (
  expenseId: string,
  cashflowIds: string[]
): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.EXPENSES, STORES.CASHFLOWS],
      'readwrite'
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    transaction.objectStore(STORES.EXPENSES).delete(expenseId);
    const cashflowStore = transaction.objectStore(STORES.CASHFLOWS);
    cashflowIds.forEach((id) => cashflowStore.delete(id));
  });
};

// ============ BACKUP / RESTORE ============

/**
 * Replace the whole database content with the given records in a single
 * atomic transaction (clear + insert across all stores). All-or-nothing:
 * if any insert fails the transaction aborts and the previous data is
 * preserved. Used by the JSON backup restore (see `src/utils/backup.ts`).
 */
export const importAllData = async (data: {
  accounts: Account[];
  expenseTypes: ExpenseType[];
  expenses: Expense[];
  cashflows: Cashflow[];
  recurringExpenses: RecurringExpense[];
}): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [
        STORES.ACCOUNTS,
        STORES.EXPENSE_TYPES,
        STORES.EXPENSES,
        STORES.CASHFLOWS,
        STORES.RECURRING_EXPENSES,
      ],
      'readwrite'
    );

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    const accounts = transaction.objectStore(STORES.ACCOUNTS);
    const expenseTypes = transaction.objectStore(STORES.EXPENSE_TYPES);
    const expenses = transaction.objectStore(STORES.EXPENSES);
    const cashflows = transaction.objectStore(STORES.CASHFLOWS);
    const recurring = transaction.objectStore(STORES.RECURRING_EXPENSES);

    accounts.clear();
    expenseTypes.clear();
    expenses.clear();
    cashflows.clear();
    recurring.clear();

    data.accounts.forEach((a) => accounts.put(a));
    data.expenseTypes.forEach((et) => expenseTypes.put(et));
    data.expenses.forEach((e) => expenses.put(e));
    data.cashflows.forEach((c) => cashflows.put(c));
    data.recurringExpenses.forEach((r) => recurring.put(r));
  });
};
