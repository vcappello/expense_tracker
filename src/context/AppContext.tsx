import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Account, Expense, ExpenseType, Cashflow, Movement, MovementFilters, RecurringExpense } from '../types';
import * as db from '../db/database';
import { getDateRange, toDateTime } from '../utils/formatting';
import { getPeriodKey } from '../utils/recurrence';
import { initializeDefaultData } from '../utils/initialization';
import { buildCoinSplitCashflows } from '../utils/coins';
import { getReimbursableSummary as computeReimbursableSummary, ReimbursableSummary } from '../utils/reimbursements';
import { BackupData } from '../utils/backup';
import { v4 as uuidv4 } from 'uuid';

// Impact info for the critical delete confirmation popups
export interface AccountDeleteInfo {
  cashflowsCount: number;
  cashflowsTotal: number;
  expensesCount: number;
  expensesTotal: number;
  recurringCount: number;
}

export interface ExpenseTypeDeleteInfo {
  expensesCount: number;
  expensesTotal: number;
  childCount: number;
  recurringCount: number;
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
  notes?: string;
  location?: string;
  reimbursable?: boolean;
  coinsAccountId?: string | null;
  coinsAmount?: number | null;
}

/**
 * Input for confirming an expected occurrence of a recurring expense: the user
 * can change the amount and the date/time (defaults: template amount, now).
 */
export interface ConfirmRecurringInput {
  recurringId: string;
  amount: number;
  date: Date;
  time: string;
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

  // Recurring expenses (templates; see spec.md → "Recurring expenses")
  recurringExpenses: RecurringExpense[];
  loadRecurringExpenses: () => Promise<void>;
  getRecurringExpense: (id: string) => Promise<RecurringExpense | undefined>;
  createRecurringExpense: (
    recurring: RecurringExpense
  ) => Promise<RecurringExpense>;
  updateRecurringExpense: (
    recurring: RecurringExpense
  ) => Promise<RecurringExpense>;
  deleteRecurringExpense: (id: string) => Promise<void>;
  confirmRecurringOccurrence: (input: ConfirmRecurringInput) => Promise<Expense>;
  /** Confirm several occurrences at once ("Conferma tutte"); undoable as a group */
  confirmRecurringOccurrences: (
    inputs: ConfirmRecurringInput[]
  ) => Promise<Expense[]>;
  skipRecurringOccurrence: (recurringId: string) => Promise<void>;
  // Last recurring confirmation (used by the Main view undo Toast)
  lastRecurringConfirmation: { expenseIds: string[]; name: string } | null;
  undoLastRecurringConfirmation: () => Promise<void>;
  clearLastRecurringConfirmation: () => void;

  // Reimbursable expenses summary (see utils/reimbursements.ts)
  getReimbursableSummary: (referenceDate: Date) => Promise<ReimbursableSummary>;

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
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [lastRecurringConfirmation, setLastRecurringConfirmation] = useState<{
    expenseIds: string[];
    name: string;
  } | null>(null);
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
      // An Expense created by a recurring confirmation keeps its template in
      // sync: deleting it un-consumes the period, so the expected occurrence is
      // proposed again (see spec.md → "Recurring expenses").
      if (current?.recurringId && current.recurringPeriod) {
        const template = await db.getRecurringExpense(current.recurringId);
        if (template && template.lastConfirmedPeriod === current.recurringPeriod) {
          const updatedTemplate: RecurringExpense = {
            ...template,
            lastConfirmedPeriod: null,
            lastConfirmedExpenseId: null,
            updatedAt: new Date(),
          };
          await db.updateRecurringExpense(updatedTemplate);
          setRecurringExpenses((prev) =>
            prev.map((r) => (r.id === updatedTemplate.id ? updatedTemplate : r))
          );
        }
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
            notes: input.notes ?? '',
            location: input.location ?? '',
            reimbursable: input.reimbursable === true,
            recurringId: current?.recurringId ?? null,
            recurringPeriod: current?.recurringPeriod ?? null,
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
          notes: input.notes ?? '',
          location: input.location ?? '',
          reimbursable: input.reimbursable === true,
          recurringId: null,
          recurringPeriod: null,
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
      recurringCount: await db.countRecurringByIndex('accountId', accountId),
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
    // Recurring templates bound to the deleted account are deleted too (the
    // Expenses already created from them are kept, their link is cleared).
    await db.deleteRecurringExpensesByAccount(accountId);
    await db.deleteAccount(accountId);

    setCashflows((prev) => prev.filter((c) => !cashflowIds.has(c.id)));
    setExpenses((prev) =>
      prev
        .filter((e) => !expenseIds.has(e.id))
        .map((e) => unlinkedExpenses.find((u) => u.id === e.id) ?? e)
    );
    setRecurringExpenses((prev) => prev.filter((r) => r.accountId !== accountId));
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
      recurringCount: (
        await Promise.all(
          [...affectedIds].map((id) =>
            db.countRecurringByIndex('expenseTypeId', id)
          )
        )
      ).reduce((sum, n) => sum + n, 0),
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
      await db.deleteRecurringExpensesByType(id);
      await db.deleteExpenseType(id);
    }

    setExpenses((prev) => prev.filter((e) => !affectedIds.has(e.expenseTypeId)));
    setRecurringExpenses((prev) =>
      prev.filter((r) => !affectedIds.has(r.expenseTypeId))
    );
    setExpenseTypes((prev) => prev.filter((t) => !affectedIds.has(t.id)));
  }, []);

  // ============ RECURRING EXPENSES ============
  const loadRecurringExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError();
      const data = await db.getRecurringExpenses();
      setRecurringExpenses(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load recurring expenses'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getRecurringExpense = useCallback(async (id: string) => {
    try {
      clearError();
      return await db.getRecurringExpense(id);
    } catch (err) {
      throw err;
    }
  }, []);

  const createRecurringExpense = useCallback(
    async (recurring: RecurringExpense) => {
      clearError();
      const created = await db.createRecurringExpense(recurring);
      setRecurringExpenses((prev) => [...prev, created]);
      return created;
    },
    []
  );

  const updateRecurringExpense = useCallback(
    async (recurring: RecurringExpense) => {
      clearError();
      const updated = await db.updateRecurringExpense(recurring);
      setRecurringExpenses((prev) =>
        prev.map((r) => (r.id === recurring.id ? updated : r))
      );
      return updated;
    },
    []
  );

  const deleteRecurringExpense = useCallback(async (id: string) => {
    try {
      clearError();
      await db.deleteRecurringExpense(id);
      setRecurringExpenses((prev) => prev.filter((r) => r.id !== id));
      // The Expenses already created from the template are kept but lose the
      // recurring link (they become normal expenses).
      setExpenses((prev) =>
        prev.map((e) =>
          e.recurringId === id
            ? { ...e, recurringId: null, recurringPeriod: null }
            : e
        )
      );
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Shared implementation of the single and bulk confirmations: creates the
   * Expense for each input and marks the period as consumed.
   */
  const confirmMany = useCallback(
    async (inputs: ConfirmRecurringInput[]): Promise<Expense[]> => {
      clearError();
      const created: Expense[] = [];
      const updatedTemplates: RecurringExpense[] = [];

      for (const input of inputs) {
        const template = await db.getRecurringExpense(input.recurringId);
        if (!template) continue;

        const now = new Date();
        const periodKey = getPeriodKey(template.frequency, now);
        const expense: Expense = {
          id: uuidv4(),
          date: input.date,
          time: input.time,
          amount: input.amount,
          expenseTypeId: template.expenseTypeId,
          accountId: template.accountId,
          routingPairId: null,
          notes: template.notes,
          location: template.location,
          reimbursable: template.reimbursable,
          recurringId: template.id,
          recurringPeriod: periodKey,
          createdAt: now,
          updatedAt: now,
        };
        await db.createExpense(expense);

        const updatedTemplate: RecurringExpense = {
          ...template,
          lastConfirmedPeriod: periodKey,
          lastConfirmedExpenseId: expense.id,
          skippedPeriod:
            template.skippedPeriod === periodKey ? null : template.skippedPeriod,
          updatedAt: now,
        };
        await db.updateRecurringExpense(updatedTemplate);

        created.push(expense);
        updatedTemplates.push(updatedTemplate);
      }

      if (created.length > 0) {
        setExpenses((prev) => [...prev, ...created]);
        setRecurringExpenses((prev) =>
          prev.map((r) => updatedTemplates.find((u) => u.id === r.id) ?? r)
        );
        setLastRecurringConfirmation({
          expenseIds: created.map((e) => e.id),
          name: created.length === 1 ? updatedTemplates[0].name : '',
        });
      }
      return created;
    },
    []
  );

  /**
   * Confirm an expected occurrence: creates the Expense (dated at the
   * confirmation date/time, with the template category/account and the
   * `recurringId`/`recurringPeriod` link) and marks the period as consumed, so
   * the same occurrence cannot be confirmed twice.
   */
  const confirmRecurringOccurrence = useCallback(
    async (input: ConfirmRecurringInput): Promise<Expense> => {
      const [expense] = await confirmMany([input]);
      return expense;
    },
    [confirmMany]
  );

  /**
   * Confirm several occurrences at once ("Conferma tutte"): the created
   * Expenses are tracked together, so the undo Toast removes them all.
   */
  const confirmRecurringOccurrences = useCallback(
    async (inputs: ConfirmRecurringInput[]): Promise<Expense[]> =>
      confirmMany(inputs),
    [confirmMany]
  );

  /**
   * Skip the current period of a template: no Expense is created and the
   * template proposes the occurrence again in the next period.
   */
  const skipRecurringOccurrence = useCallback(async (recurringId: string) => {
    clearError();
    const template = await db.getRecurringExpense(recurringId);
    if (!template) return;
    const updated: RecurringExpense = {
      ...template,
      skippedPeriod: getPeriodKey(template.frequency, new Date()),
      updatedAt: new Date(),
    };
    await db.updateRecurringExpense(updated);
    setRecurringExpenses((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
  }, []);

  const clearLastRecurringConfirmation = useCallback(() => {
    setLastRecurringConfirmation(null);
  }, []);

  const undoLastRecurringConfirmation = useCallback(async () => {
    if (!lastRecurringConfirmation) return;
    for (const expenseId of lastRecurringConfirmation.expenseIds) {
      await deleteExpense(expenseId);
    }
    setLastRecurringConfirmation(null);
  }, [lastRecurringConfirmation, deleteExpense]);

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

  // ============ REIMBURSABLE SUMMARY ============
  const getReimbursableSummary = useCallback(async (referenceDate: Date) => {
    try {
      clearError();
      const [allExpenses, allCashflows] = await Promise.all([
        db.getExpenses(),
        db.getCashflows(),
      ]);
      return computeReimbursableSummary(allExpenses, allCashflows, referenceDate);
    } catch (err) {
      throw err;
    }
  }, []);

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
          loadRecurringExpenses(),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to restore backup');
        throw err;
      }
    },
    [loadAccounts, loadExpenseTypes, loadExpenses, loadCashflows, loadRecurringExpenses]
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

    // Recurring expenses
    recurringExpenses,
    loadRecurringExpenses,
    getRecurringExpense,
    createRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    confirmRecurringOccurrence,
    confirmRecurringOccurrences,
    skipRecurringOccurrence,
    lastRecurringConfirmation,
    undoLastRecurringConfirmation,
    clearLastRecurringConfirmation,

    // Reimbursable summary
    getReimbursableSummary,

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
