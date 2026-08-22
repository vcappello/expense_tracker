import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Account, Expense, ExpenseType, Cashflow, Movement, MovementFilters } from '../types';
import * as db from '../db/database';
import { getDateRange, toDateTime } from '../utils/formatting';
import { initializeDefaultData } from '../utils/initialization';
import { routingCounterpartIds } from '../utils/routing';

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

  // Cashflows
  cashflows: Cashflow[];
  loadCashflows: () => Promise<void>;
  createCashflow: (cashflow: Cashflow) => Promise<Cashflow>;
  updateCashflow: (cashflow: Cashflow) => Promise<Cashflow>;
  deleteCashflow: (id: string) => Promise<void>;
  getCashflow: (id: string) => Promise<Cashflow | undefined>;

  // Cascading deletes (Account / ExpenseType with linked movements)
  getAccountDeleteInfo: (accountId: string) => Promise<AccountDeleteInfo>;
  deleteAccountCascade: (accountId: string) => Promise<void>;
  getExpenseTypeDeleteInfo: (typeId: string) => Promise<ExpenseTypeDeleteInfo>;
  deleteExpenseTypeCascade: (typeId: string) => Promise<void>;

  // Movements (combined Expense + Cashflow)
  movements: Movement[];
  loadMovements: (filters: MovementFilters) => Promise<void>;

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
      await db.deleteExpense(id);
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

  // ============ CASCADING DELETES ============

  const getAccountDeleteInfo = useCallback(async (accountId: string) => {
    const accountCashflows = await db.getCashflowsByAccount(accountId);
    const accountExpenses = await db.getExpensesByAccount(accountId);
    return {
      cashflowsCount: accountCashflows.length,
      cashflowsTotal: accountCashflows.reduce((sum, c) => sum + c.amount, 0),
      expensesCount: accountExpenses.length,
      expensesTotal: accountExpenses.reduce((sum, e) => sum + e.amount, 0),
    };
  }, []);

  const deleteAccountCascade = useCallback(async (accountId: string) => {
    await db.deleteCashflowsByAccount(accountId);
    await db.deleteExpensesByAccount(accountId);
    await db.deleteAccount(accountId);
    setCashflows((prev) => prev.filter((cf) => cf.accountId !== accountId));
    setExpenses((prev) => prev.filter((e) => e.accountId !== accountId));
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

        // For routing transfers show only one movement (the receiving one,
        // yellow); hide the negative counterpart on the routing account.
        const hiddenCashflowIds = routingCounterpartIds(cashflowData);
        const displayableMovements = movementList.filter(
          (m) => m.type === 'expense' || !hiddenCashflowIds.has(m.id)
        );

        // Sort by date and time descending (most recent first)
        displayableMovements.sort(
          (a, b) =>
            toDateTime(b.date, b.time).getTime() -
            toDateTime(a.date, a.time).getTime()
        );

        setMovements(displayableMovements);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load movements');
      } finally {
        setIsLoading(false);
      }
    },
    []
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

    // Cashflows
    cashflows,
    loadCashflows,
    createCashflow,
    updateCashflow,
    deleteCashflow,
    getCashflow,

    // Cascading deletes
    getAccountDeleteInfo,
    deleteAccountCascade,
    getExpenseTypeDeleteInfo,
    deleteExpenseTypeCascade,

    // Movements
    movements,
    loadMovements,

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
