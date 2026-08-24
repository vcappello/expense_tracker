import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Account, Expense, ExpenseType, Cashflow, Movement, MovementFilters } from '../types';
import * as db from '../db/database';
import { getDateRange, toDateTime } from '../utils/formatting';
import { initializeDefaultData } from '../utils/initialization';
import { buildCoinSplitCashflows } from '../utils/coins';
import { BackupData } from '../utils/backup';
import { v4 as uuidv4 } from 'uuid';

// Impact info for the critical delete confirmation popups
export interface AccountDeleteInfo {
  cashflowsCount: number;
  cashflowsTotal: number;
  expensesCount: number;
  expensesTotal: number;
}

export interface ExpenseTypeDeleteInfo {
  expensesCount: number;
  expensesTotal: number;
  childCount: number;
}

// Input for saving an Expense, optionally paid partly from a second account
// (coin split). When coinsAccountId and coinsAmount > 0 are provided, the
// whole group (Expense + internal income + routing pair) is saved atomically.
export interface ExpenseWithCoinsInput {
  expenseId?: string;
  date: Date;
  time: string;
  amount: number;
  expenseTypeId: string;
  accountId: string;
  coinsAccountId?: string | null;
  coinsAmount?: number | null;
}

/**
 * Ids of the cashflows affected by deleting `accountId`: all cashflows on the
 * account (as own account or routing source) plus every cashflow of the same
 * routing/coin-split group (routingPairId), so no orphan leg remains on the
 * other account.
 */
const collectAccountCashflowIds = (
  allCashflows: Cashflow[],
  accountId: string
): Set<string> => {
  const ids = new Set(
    allCashflows
      .filter(
        (c) => c.accountId === accountId || c.routingAccountId === accountId
      )
      .map((c) => c.id)
  );
  for (const c of allCashflows) {
    if (
      c.routingPairId &&
      allCashflows.some(
        (o) => o.routingPairId === c.routingPairId && ids.has(o.id)
      )
    ) {
      ids.add(c.id);
    }
  }
  return ids;
};

interface AppContextType {
  // Accounts
  accounts: Account[];
  loadAccounts: () => Promise<void>;
  createAccount: (account: Account) => Promise<Account>;
  updateAccount: (account: Account) => Promise<Account>;
  deleteAccount: (id: string) => Promise<void>;
  getAccount: (id: string) => Promise<Account | undefined>;

  // ExpenseTypes
  expenseTypes: ExpenseType[];
  loadExpenseTypes: () => Promise<void>;
  createExpenseType: (expenseType: ExpenseType) => Promise<ExpenseType>;
  updateExpenseType: (expenseType: ExpenseType) => Promise<ExpenseType>;
  deleteExpenseType: (id: string) => Promise<void>;
  getExpenseType: (id: string) => Promise<ExpenseType | undefined>;

  // Expenses
  expenses: Expense[];
  loadExpenses: () => Promise<void>;
  createExpense: (expense: Expense) => Promise<Expense>;
  updateExpense: (expense: Expense) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;
  getExpense: (id: string) => Promise<Expense | undefined>;
  saveExpenseWithCoins: (input: ExpenseWithCoinsInput) => Promise<Expense>;

  // Cashflows
  cashflows: Cashflow[];
  loadCashflows: () => Promise<void>;
  createCashflow: (cashflow: Cashflow) => Promise<Cashflow>;
  updateCashflow: (cashflow: Cashflow) => Promise<Cashflow>;
  deleteCashflow: (id: string) => Promise<void>;
  getCashflow: (id: string) => Promise<Cashflow | undefined>;
  getCashflows: () => Promise<Cashflow[]>;

  // Cascading deletes (Account / ExpenseType with linked movements)
  getAccountDeleteInfo: (accountId: string) => Promise<AccountDeleteInfo>;
  deleteAccountCascade: (accountId: string) => Promise<void>;
  getExpenseTypeDeleteInfo: (typeId: string) => Promise<ExpenseTypeDeleteInfo>;
  deleteExpenseTypeCascade: (typeId: string) => Promise<void>;

  // Movements (combined Expense + Cashflow)
  movements: Movement[];
  loadMovements: (filters: MovementFilters) => Promise<void>;

  // Backup / Restore (JSON export/import, see utils/backup.ts)
  restoreBackup: (data: BackupData) => Promise<void>;

  // Loading state
  isLoading: boolean;
  error: string | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Initialize accounts and expense types on mount.
  // Wait for the default-data seed first, otherwise on a fresh database the
  // seed (idempotent, shared promise) may still be creating the defaults when
  // we read them, leaving the app with empty accounts/categories.
  useEffect(() => {
    const init = async () => {
      try {
        await initializeDefaultData();
        const accountsData = await db.getAccounts();
        setAccounts(accountsData);

        const typesData = await db.getExpenseTypes();
        setExpenseTypes(typesData);
      } catch (err) {
        console.error('Failed to initialize app context:', err);
      }
    };

    init();
  }, []);

  // ============ ACCOUNTS ============
  const loadAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError();
      const data = await db.getAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createAccount = useCallback(async (account: Account) => {
    try {
      clearError();
      const newAccount = await db.createAccount(account);
      setAccounts((prev) => [...prev, newAccount]);
      return newAccount;
    } catch (err) {
      throw err;
    }
  }, []);

  const updateAccount = useCallback(async (account: Account) => {
    try {
      clearError();
      const updated = await db.updateAccount(account);
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? updated : a))
      );
      return updated;
    } catch (err) {
      throw err;
    }
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    try {
      clearError();
      await db.deleteAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      throw err;
    }
  }, []);

  const getAccount = useCallback(async (id: string) => {
    try {
      clearError();
      return await db.getAccount(id);
    } catch (err) {
      throw err;
    }
  }, []);

  // ============ EXPENSE TYPES ============
  const loadExpenseTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError();
      const data = await db.getExpenseTypes();
      setExpenseTypes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expense types');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createExpenseType = useCallback(async (expenseType: ExpenseType) => {
    try {
      clearError();
      const newType = await db.createExpenseType(expenseType);
      setExpenseTypes((prev) => [...prev, newType]);
      return newType;
    } catch (err) {
      throw err;
    }
  }, []);

  const updateExpenseType = useCallback(async (expenseType: ExpenseType) => {
    try {
      clearError();
      const updated = await db.updateExpenseType(expenseType);
      setExpenseTypes((prev) =>
        prev.map((et) => (et.id === expenseType.id ? updated : et))
      );
      return updated;
    } catch (err) {
      throw err;
    }
  }, []);

  const deleteExpenseType = useCallback(async (id: string) => {
    try {
      clearError();
      await db.deleteExpenseType(id);
      setExpenseTypes((prev) => prev.filter((et) => et.id !== id));
    } catch (err) {
      throw err;
    }
  }, []);

  const getExpenseType = useCallback(async (id: string) => {
    try {
      clearError();
      return await db.getExpenseType(id);
    } catch (err) {
      throw err;
    }
  }, []);

  // ============ EXPENSES ============
  const loadExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError();
      const data = await db.getExpenses();
      setExpenses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createExpense = useCallback(async (expense: Expense) => {
    try {
      clearError();
      const newExpense = await db.createExpense(expense);
      setExpenses((prev) => [...prev, newExpense]);
      return newExpense;
    } catch (err) {
      throw err;
    }
  }, []);

  const updateExpense = useCallback(async (expense: Expense) => {
    try {
      clearError();
      const updated = await db.updateExpense(expense);
      setExpenses((prev) =>
        prev.map((e) => (e.id === expense.id ? updated : e))
      );
      return updated;
    } catch (err) {
      throw err;
    }
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    try {
      clearError();
      const current = await db.getExpense(id);
      if (current?.routingPairId) {
        // Delete also the linked coin-split cashflows (internal income +
        // routing pair) atomically.
        const groupCashflowIds = (await db.getCashflows())
          .filter((c) => c.routingPairId === current.routingPairId)
          .map((c) => c.id);
        await db.deleteExpenseGroup(id, groupCashflowIds);
      } else {
        await db.deleteExpense(id);
      }
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      throw err;
    }
  }, []);

  const getExpense = useCallback(async (id: string) => {
    try {
      clearError();
      return await db.getExpense(id);
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Save an Expense, optionally paid partly from a second account (coin
   * split). Handles both create and edit: when coins are provided the whole
   * group (Expense + internal income + routing pair) is saved atomically; when
   * editing, the previous linked cashflows are replaced/removed via the link.
   */
  const saveExpenseWithCoins = useCallback(
    async (input: ExpenseWithCoinsInput): Promise<Expense> => {
      try {
        clearError();
        const coinsAccountId = input.coinsAccountId || '';
        const coinsAmount = input.coinsAmount ?? 0;
        const coins =
          coinsAccountId !== '' &&
          coinsAccountId !== input.accountId &&
          coinsAmount > 0;
        if (coins && coinsAmount > input.amount) {
          throw new Error(
            'L\'importo in monete non può superare l\'importo totale della spesa'
          );
        }
        const now = new Date();

        if (input.expenseId) {
          // EDIT: reconcile the existing group via the explicit link.
          const current = await db.getExpense(input.expenseId);
          const currentPairId = current?.routingPairId ?? null;
          const pairId = coins ? currentPairId ?? uuidv4() : null;

          const expense: Expense = {
            id: input.expenseId,
            date: input.date,
            time: input.time,
            amount: input.amount,
            expenseTypeId: input.expenseTypeId,
            accountId: input.accountId,
            routingPairId: pairId,
            createdAt: current?.createdAt ?? now,
            updatedAt: now,
          };

          const oldCashflowIds = currentPairId
            ? (await db.getCashflows())
                .filter((c) => c.routingPairId === currentPairId)
                .map((c) => c.id)
            : [];

          const newCashflows =
            coins && pairId
              ? buildCoinSplitCashflows({
                  pairId,
                  date: input.date,
                  time: input.time,
                  coinsAmount,
                  mainAccountId: input.accountId,
                  coinsAccountId,
                })
              : [];

          await db.updateExpenseGroup(expense, oldCashflowIds, newCashflows);
          setExpenses((prev) =>
            prev.map((e) => (e.id === expense.id ? expense : e))
          );
          return expense;
        }

        // CREATE
        const pairId = coins ? uuidv4() : null;
        const expense: Expense = {
          id: uuidv4(),
          date: input.date,
          time: input.time,
          amount: input.amount,
          expenseTypeId: input.expenseTypeId,
          accountId: input.accountId,
          routingPairId: pairId,
          createdAt: now,
          updatedAt: now,
        };

        if (coins && pairId) {
          const cashflows = buildCoinSplitCashflows({
            pairId,
            date: input.date,
            time: input.time,
            coinsAmount,
            mainAccountId: input.accountId,
            coinsAccountId,
          });
          await db.createExpenseGroup(expense, cashflows);
        } else {
          await db.createExpense(expense);
        }
        setExpenses((prev) => [...prev, expense]);
        return expense;
      } catch (err) {
        throw err;
      }
    },
    []
  );

  // ============ CASHFLOWS ============
  const loadCashflows = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError();
      const data = await db.getCashflows();
      setCashflows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cashflows');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCashflow = useCallback(async (cashflow: Cashflow) => {
    try {
      clearError();
      const newCashflow = await db.createCashflow(cashflow);
      setCashflows((prev) => [...prev, newCashflow]);
      return newCashflow;
    } catch (err) {
      throw err;
    }
  }, []);

  const updateCashflow = useCallback(async (cashflow: Cashflow) => {
    try {
      clearError();
      const updated = await db.updateCashflow(cashflow);
      setCashflows((prev) =>
        prev.map((cf) => (cf.id === cashflow.id ? updated : cf))
      );
      return updated;
    } catch (err) {
      throw err;
    }
  }, []);

  const deleteCashflow = useCallback(async (id: string) => {
    try {
      clearError();
      await db.deleteCashflow(id);
      setCashflows((prev) => prev.filter((cf) => cf.id !== id));
    } catch (err) {
      throw err;
    }
  }, []);

  const getCashflow = useCallback(async (id: string) => {
    try {
      clearError();
      return await db.getCashflow(id);
    } catch (err) {
      throw err;
    }
  }, []);

  const getCashflows = useCallback(async () => {
    try {
      clearError();
      return await db.getCashflows();
    } catch (err) {
      throw err;
    }
  }, []);

  // ============ CASCADING DELETES ============

  const getAccountDeleteInfo = useCallback(async (accountId: string) => {
    const allCashflows = await db.getCashflows();
    const accountExpenses = await db.getExpensesByAccount(accountId);
    const cashflowIds = collectAccountCashflowIds(allCashflows, accountId);
    const accountCashflows = allCashflows.filter((c) => cashflowIds.has(c.id));
    return {
      cashflowsCount: accountCashflows.length,
      cashflowsTotal: accountCashflows.reduce((sum, c) => sum + c.amount, 0),
      expensesCount: accountExpenses.length,
      expensesTotal: accountExpenses.reduce((sum, e) => sum + e.amount, 0),
    };
  }, []);

  const deleteAccountCascade = useCallback(async (accountId: string) => {
    const allCashflows = await db.getCashflows();
    const allExpenses = await db.getExpenses();

    // Cashflows on the deleted account (as own account or routing source) plus
    // the whole routing/coin-split group they belong to: no orphan legs.
    const cashflowIds = collectAccountCashflowIds(allCashflows, accountId);

    // Expenses on the deleted account.
    const expenseIds = new Set(
      allExpenses
        .filter((e) => e.accountId === accountId)
        .map((e) => e.id)
    );

    // Coin-split expenses NOT on the deleted account but whose group cashflows
    // are removed (e.g. deleting the coins account): clear the link so the
    // expense becomes a plain expense (no dangling reference).
    const unlinkedExpenses = allExpenses
      .filter(
        (e) =>
          e.accountId !== accountId &&
          e.routingPairId &&
          allCashflows.some(
            (c) => c.routingPairId === e.routingPairId && cashflowIds.has(c.id)
          )
      )
      .map((e) => ({ ...e, routingPairId: null, updatedAt: new Date() }));

    for (const cid of cashflowIds) await db.deleteCashflow(cid);
    for (const eid of expenseIds) await db.deleteExpense(eid);
    for (const e of unlinkedExpenses) await db.updateExpense(e);
    await db.deleteAccount(accountId);

    setCashflows((prev) => prev.filter((c) => !cashflowIds.has(c.id)));
    setExpenses((prev) =>
      prev
        .filter((e) => !expenseIds.has(e.id))
        .map((e) => unlinkedExpenses.find((u) => u.id === e.id) ?? e)
    );
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  }, []);

  const getExpenseTypeDeleteInfo = useCallback(async (typeId: string) => {
    const allTypes = await db.getExpenseTypes();
    const children = allTypes.filter((t) => t.parentId === typeId);
    const affectedIds = new Set([typeId, ...children.map((c) => c.id)]);
    const allExpenses = await db.getExpenses();
    const affectedExpenses = allExpenses.filter((e) =>
      affectedIds.has(e.expenseTypeId)
    );
    return {
      expensesCount: affectedExpenses.length,
      expensesTotal: affectedExpenses.reduce((sum, e) => sum + e.amount, 0),
      childCount: children.length,
    };
  }, []);

  const deleteExpenseTypeCascade = useCallback(async (typeId: string) => {
    const allTypes = await db.getExpenseTypes();
    const children = allTypes.filter((t) => t.parentId === typeId);
    const affectedIds = new Set([typeId, ...children.map((c) => c.id)]);

    // Clean up the coin-split groups of the deleted expenses (no orphan legs).
    const allExpenses = await db.getExpenses();
    const affectedExpenses = allExpenses.filter((e) =>
      affectedIds.has(e.expenseTypeId)
    );
    const groupPairIds = new Set(
      affectedExpenses
        .map((e) => e.routingPairId)
        .filter((p): p is string => !!p)
    );
    if (groupPairIds.size > 0) {
      const groupCashflowIds = (await db.getCashflows())
        .filter((c) => c.routingPairId && groupPairIds.has(c.routingPairId))
        .map((c) => c.id);
      for (const cid of groupCashflowIds) await db.deleteCashflow(cid);
    }

    for (const id of affectedIds) {
      await db.deleteExpensesByType(id);
      await db.deleteExpenseType(id);
    }

    setExpenses((prev) => prev.filter((e) => !affectedIds.has(e.expenseTypeId)));
    setExpenseTypes((prev) => prev.filter((t) => !affectedIds.has(t.id)));
  }, []);

  // ============ MOVEMENTS ============
  const loadMovements = useCallback(
    async (filters: MovementFilters) => {
      try {
        setIsLoading(true);
        clearError();

        const { start, end } = getDateRange(filters.dateRange);
        const expenseData = await db.getExpensesByDateRange(start, end);
        const cashflowData = await db.getCashflowsByDateRange(start, end);

        const movementList: Movement[] = [
          ...expenseData.map((e) => ({ ...e, type: 'expense' as const })),
          ...cashflowData.map((cf) => ({ ...cf, type: 'cashflow' as const })),
        ];

        // Sort by date and time descending (most recent first). The list keeps
        // ALL movements of the period; hiding the internal routing/coin-split
        // cashflows is a display concern of each view (Main view, Analytics),
        // so Analytics can still count the internal income (option A).
        movementList.sort(
          (a, b) =>
            toDateTime(b.date, b.time).getTime() -
            toDateTime(a.date, a.time).getTime()
        );

        setMovements(movementList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load movements');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ============ BACKUP / RESTORE ============
  const restoreBackup = useCallback(
    async (data: BackupData) => {
      try {
        clearError();
        await db.importAllData(data);
        await Promise.all([
          loadAccounts(),
          loadExpenseTypes(),
          loadExpenses(),
          loadCashflows(),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to restore backup');
        throw err;
      }
    },
    [loadAccounts, loadExpenseTypes, loadExpenses, loadCashflows]
  );

  const value: AppContextType = {
    // Accounts
    accounts,
    loadAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    getAccount,

    // ExpenseTypes
    expenseTypes,
    loadExpenseTypes,
    createExpenseType,
    updateExpenseType,
    deleteExpenseType,
    getExpenseType,

    // Expenses
    expenses,
    loadExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpense,
    saveExpenseWithCoins,

    // Cashflows
    cashflows,
    loadCashflows,
    createCashflow,
    updateCashflow,
    deleteCashflow,
    getCashflow,
    getCashflows,

    // Cascading deletes
    getAccountDeleteInfo,
    deleteAccountCascade,
    getExpenseTypeDeleteInfo,
    deleteExpenseTypeCascade,

    // Movements
    movements,
    loadMovements,

    // Backup / Restore
    restoreBackup,

    // State
    isLoading,
    error,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
