import { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DateRange, Movement } from '../types';
import TitleBar from '../components/TitleBar';
import ActionMenu from '../components/ActionMenu';
import MultiSelectFilter from '../components/MultiSelectFilter';
import MovementsChart, { DailyTotal } from '../components/MovementsChart';
import MonthBreakdownChart from '../components/MonthBreakdownChart';
import BalanceTrendChart, { BalancePoint } from '../components/BalanceTrendChart';
import { getDateRange, abbreviateAmount, formatCurrency, formatDate } from '../utils/formatting';
import { sortAccountsPreferred } from '../utils/accounts';
import { isRoutingCashflow, routingCounterpartIds } from '../utils/routing';
import {
  ExpectedOccurrence,
  EXPECTED_EXPENSE_TYPE_ID,
  EXPECTED_EXPENSE_TYPE_LABEL,
  getExpectedOccurrences,
} from '../utils/recurrence';
import { exportMovementsToCSV, ExpectedCsvRow } from '../utils/csv';
import '../styles/AnalyticsPage.css';

// Visualizations available in the Analytics view (switched from the title bar pill)
const VIEW_OPTIONS: { value: 'report' | 'grafico' | 'andamento'; label: string }[] = [
  { value: 'report', label: '📋 Report' },
  { value: 'grafico', label: '📊 Grafico' },
  { value: 'andamento', label: '📈 Andamento' },
];

export default function AnalyticsPage() {
  const {
    accounts,
    expenseTypes,
    movements,
    loadMovements,
    recurringExpenses,
    loadRecurringExpenses,
    isLoading,
    movementsLoaded,
  } = useApp();
  const [dateRange, setDateRange] = useState<DateRange>('current-month');
  // Empty array = no filter (all)
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [view, setView] = useState<'report' | 'grafico' | 'andamento'>('report');

  // Load the movements here with the full range ('all'): this page applies its
  // own date filter, so relying on the Main view load would scope the data to
  // the Main view filter (and leave the totals empty on a direct reload).
  useEffect(() => {
    loadMovements({ dateRange: 'all' });
    loadRecurringExpenses();
  }, [loadMovements]);

  // Selected categories expanded with their descendants (hierarchy): selecting a
  // parent category also covers its children.
  const expandedTypeIds = useMemo(() => {
    const acc = new Set<string>();
    const collect = (typeId: string): void => {
      acc.add(typeId);
      expenseTypes
        .filter((t) => t.parentId === typeId)
        .forEach((child) => collect(child.id));
    };
    selectedTypeIds.forEach(collect);
    return acc;
  }, [selectedTypeIds, expenseTypes]);

  // Filter movements based on selected filters
  const filteredMovements = useMemo(() => {
    const { start, end } = getDateRange(dateRange);

    return movements.filter((m) => {
      const isInDateRange = new Date(m.date) >= start && new Date(m.date) <= end;
      const isExpense = m.type === 'expense';
      const matchesType =
        selectedTypeIds.length === 0 ||
        (isExpense && expandedTypeIds.has(m.expenseTypeId));
      const matchesAccount =
        selectedAccountIds.length === 0 || selectedAccountIds.includes(m.accountId);

      return isInDateRange && matchesType && matchesAccount;
    });
  }, [movements, dateRange, selectedTypeIds, expandedTypeIds, selectedAccountIds]);

  // Separate expenses and cashflows
  const expenses = useMemo(() => filteredMovements.filter((m) => m.type === 'expense'), [filteredMovements]);
  const cashflows = useMemo(() => filteredMovements.filter((m) => m.type === 'cashflow'), [filteredMovements]);

  /**
   * Expected (recurring, not yet confirmed) occurrences counted in this view:
   * they belong to the period that contains their DUE DATE and follow the
   * "Conto" filter, while the "Categoria" filter does not apply (the dedicated
   * pseudo-category is not a real ExpenseType). They never touch the account
   * balances nor the Cashflow totals.
   */
  const expectedOccurrences = useMemo(() => {
    const { start, end } = getDateRange(dateRange);
    return getExpectedOccurrences(recurringExpenses).filter((occurrence) => {
      const due = occurrence.dueDate;
      const inRange = due >= start && due <= end;
      const matchesAccount =
        selectedAccountIds.length === 0 ||
        selectedAccountIds.includes(occurrence.template.accountId);
      return inRange && matchesAccount;
    });
  }, [recurringExpenses, dateRange, selectedAccountIds]);

  const expectedTotal = useMemo(
    () => expectedOccurrences.reduce((sum, o) => sum + o.amount, 0),
    [expectedOccurrences]
  );

  // Synthetic ExpensesType used by the charts / CSV for the expected category
  const expectedType = useMemo(
    () => [
      ...expenseTypes,
      {
        id: EXPECTED_EXPENSE_TYPE_ID,
        name: EXPECTED_EXPENSE_TYPE_LABEL,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    [expenseTypes]
  );

  // Calculate summary statistics
  const summary = useMemo(() => {
    // Expected (recurring) expenses are counted in the totals
    const totalExpenses =
      expenses.reduce((sum, e) => sum + e.amount, 0) + expectedTotal;

    const nonRoutingCashflows = cashflows.filter((c) => !isRoutingCashflow(c, cashflows));
    const totalCashflows = nonRoutingCashflows.reduce((sum, c) => sum + c.amount, 0);

    // Average daily expense = total expenses / number of days in the selected period
    const { start, end } = getDateRange(dateRange);
    const daysInPeriod =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const avgExpense = daysInPeriod > 0 ? totalExpenses / daysInPeriod : 0;

    // Top 3 categories (the expected ones are aggregated in a dedicated one)
    const categoryTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryTotals[e.expenseTypeId] = (categoryTotals[e.expenseTypeId] || 0) + e.amount;
    });
    if (expectedTotal > 0) {
      categoryTotals[EXPECTED_EXPENSE_TYPE_ID] = expectedTotal;
    }

    const topCategories = Object.entries(categoryTotals)
      .map(([typeId, total]) => ({
        typeId,
        typeName:
          typeId === EXPECTED_EXPENSE_TYPE_ID
            ? EXPECTED_EXPENSE_TYPE_LABEL
            : expenseTypes.find((et) => et.id === typeId)?.name || 'Sconosciuto',
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    return {
      totalExpenses,
      totalCashflows,
      avgExpense,
      expenseCount: expenses.length,
      expectedCount: expectedOccurrences.length,
      cashflowCount: nonRoutingCashflows.length,
      topCategories,
    };
  }, [expenses, cashflows, expenseTypes, dateRange, expectedTotal, expectedOccurrences]);

  // Aggregate movements by day for the chart (expenses by category + non-routing cashflows)
  const chartData = useMemo<DailyTotal[]>(() => {
    const byDay: Record<string, DailyTotal> = {};

    [...filteredMovements]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((m) => {
        const d = new Date(m.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
        if (!byDay[key]) {
          byDay[key] = { key, label: formatDate(m.date), cashflow: 0, expensesByType: {} };
        }
        if (m.type === 'expense') {
          byDay[key].expensesByType[m.expenseTypeId] =
            (byDay[key].expensesByType[m.expenseTypeId] || 0) + m.amount;
        } else if (!isRoutingCashflow(m, cashflows)) {
          byDay[key].cashflow += m.amount;
        }
      });

    // Expected (recurring) expenses: stacked under the dedicated category
    expectedOccurrences.forEach((occurrence) => {
      const d = occurrence.dueDate;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      if (!byDay[key]) {
        byDay[key] = { key, label: formatDate(d), cashflow: 0, expensesByType: {} };
      }
      byDay[key].expensesByType[EXPECTED_EXPENSE_TYPE_ID] =
        (byDay[key].expensesByType[EXPECTED_EXPENSE_TYPE_ID] || 0) +
        occurrence.amount;
    });

    return Object.values(byDay);
  }, [filteredMovements, cashflows, expectedOccurrences]);
  // Single-month breakdown: totals by expense category and cashflow account
  const monthBreakdown = useMemo(() => {
    const byType: Record<string, number> = {};
    const byAccount: Record<string, number> = {};
    filteredMovements.forEach((m) => {
      if (m.type === 'expense') {
        byType[m.expenseTypeId] = (byType[m.expenseTypeId] || 0) + m.amount;
      } else if (!isRoutingCashflow(m, cashflows)) {
        byAccount[m.accountId] = (byAccount[m.accountId] || 0) + m.amount;
      }
    });
    if (expectedTotal > 0) {
      byType[EXPECTED_EXPENSE_TYPE_ID] = expectedTotal;
    }
    return {
      expensesByType: Object.entries(byType).map(([typeId, total]) => ({ typeId, total })),
      cashflowsByAccount: Object.entries(byAccount).map(([accountId, total]) => ({
        accountId,
        total,
      })),
    };
  }, [filteredMovements, cashflows, expectedTotal]);

  /**
   * Balance trend ("Andamento" view): the cumulative balance day by day.
   *
   * The opening balance is the REAL one: the `initialBalance` of the accounts in
   * scope plus every movement before the period start, with the same formula used
   * by "Gestione Conti" (`initialBalance + cashflows - expenses`; expenses are
   * stored as positive amounts and are subtracted here). The full movements
   * dataset is used, so both legs of a routing transfer and the internal income of
   * a coin-split expense are counted: the last point of the line equals the real
   * account balance.
   * Expected (recurring) expenses are NOT counted: no money has moved yet.
   */
  const balanceTrend = useMemo(() => {
    const range = getDateRange(dateRange);
    const rangeStartTime = range.start.getTime();
    const rangeEndTime = range.end.getTime();
    const inAccountScope = (accountId: string) =>
      selectedAccountIds.length === 0 || selectedAccountIds.includes(accountId);
    // Expenses count only when they belong to the selected categories (expanded
    // to their descendants); cashflows have no category and are always part of
    // the balance.
    const countsMovement = (m: Movement) =>
      m.type === 'cashflow' ||
      expandedTypeIds.size === 0 ||
      expandedTypeIds.has(m.expenseTypeId);
    const contribution = (m: Movement) => (m.type === 'expense' ? -m.amount : m.amount);

    const relevant = movements.filter(
      (m) => inAccountScope(m.accountId) && countsMovement(m)
    );

    let firstMovement: number | null = null;
    let lastInPeriod: number | null = null;
    let inPeriodCount = 0;
    relevant.forEach((m) => {
      const t = new Date(m.date).getTime();
      if (firstMovement === null || t < firstMovement) firstMovement = t;
      if (t >= rangeStartTime && t <= rangeEndTime) {
        inPeriodCount += 1;
        if (lastInPeriod === null || t > lastInPeriod) lastInPeriod = t;
      }
    });

    // No movement in the selected period: the page shows its empty state.
    if (inPeriodCount === 0) return { points: [], openingBalance: 0 };

    // Effective period: the start is clamped to the data so "Tutto il periodo"
    // (raw range 1970–2099) does not produce thousands of empty points; the end
    // stops at today, but a movement dated in the future inside the range is kept.
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const startTime = Math.max(rangeStartTime, firstMovement ?? rangeStartTime);
    const endTime = Math.max(
      Math.min(rangeEndTime, today.getTime()),
      lastInPeriod ?? 0
    );
    if (startTime > endTime) return { points: [], openingBalance: 0 };

    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;

    // Bucket the movements by day: the day loop below stays O(days) instead of
    // O(days x movements).
    const deltasByDay = new Map<string, number>();
    let openingBalance = accounts
      .filter((a) => inAccountScope(a.id))
      .reduce((sum, a) => sum + (a.initialBalance || 0), 0);

    relevant.forEach((m) => {
      const when = new Date(m.date);
      const value = contribution(m);
      if (when.getTime() < startTime) {
        // Movements before the period (or before the first one kept on the axis)
        // build the opening balance.
        openingBalance += value;
      } else if (when.getTime() <= endTime) {
        const key = dayKey(when);
        deltasByDay.set(key, (deltasByDay.get(key) || 0) + value);
      }
    });

    const points: BalancePoint[] = [];
    let balance = openingBalance;
    const cursor = new Date(startTime);
    while (cursor.getTime() <= endTime) {
      const key = dayKey(cursor);
      const delta = deltasByDay.get(key) || 0;
      balance += delta;
      points.push({ key, label: formatDate(cursor), balance, delta });
      cursor.setDate(cursor.getDate() + 1);
    }

    return { points, openingBalance };
  }, [movements, accounts, dateRange, selectedAccountIds, expandedTypeIds]);

  // Movements shown in the report list / CSV export: same display rule as the
  // Main view (hide routing counterparts and coin-split internal incomes),
  // while the summary totals still count the internal income (option A).
  const reportMovements = useMemo(() => {
    const hiddenCashflowIds = routingCounterpartIds(cashflows);
    return filteredMovements.filter(
      (m) => m.type === 'expense' || !hiddenCashflowIds.has(m.id)
    );
  }, [filteredMovements, cashflows]);

  /**
   * Rows of the report list: the movements plus the expected (recurring)
   * occurrences, merged and sorted by date (most recent first) so the list
   * explains the totals.
   */
  const reportItems = useMemo(
    () =>
      [
        ...reportMovements.map((movement) => ({
          kind: 'movement' as const,
          date: new Date(movement.date),
          movement,
        })),
        ...expectedOccurrences.map((occurrence) => ({
          kind: 'expected' as const,
          date: occurrence.dueDate,
          occurrence,
        })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [reportMovements, expectedOccurrences]
  );

  // Expected rows exported in the CSV (same values used by the totals)
  const expectedCsvRows: ExpectedCsvRow[] = expectedOccurrences.map(
    (occurrence) => ({
      dueDate: occurrence.dueDate,
      amount: occurrence.amount,
      categoryName: EXPECTED_EXPENSE_TYPE_LABEL,
      accountName:
        accounts.find((a) => a.id === occurrence.template.accountId)?.name || '',
    })
  );

  const isMonthView = dateRange === 'current-month' || dateRange === 'previous-month';
  const viewLabel = VIEW_OPTIONS.find((option) => option.value === view)?.label || '';

  return (
    <div className="analytics-page">
      <TitleBar
        title="Analisi"
        extraActions={
          <ActionMenu
            triggerLabel="Vista"
            trigger={<span className="filter-value">{viewLabel}</span>}
            className="filter-menu"
            items={VIEW_OPTIONS.map((option) => ({
              label: option.label,
              active: view === option.value,
              onClick: () => setView(option.value),
            }))}
          />
        }
        menu={[
          {
            label: 'Esporta CSV',
            onClick: () =>
              exportMovementsToCSV(
                reportMovements,
                accounts,
                expenseTypes,
                expectedCsvRows
              ),
            disabled: reportItems.length === 0,
          },
        ]}
      />

      <main className="analytics-content">
        {/* Filters */}
        <div className="analytics-filters">
          <div className="filter-group">
            <label>Periodo</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="filter-select"
            >
              <option value="current-month">Questo mese</option>
              <option value="previous-month">Mese scorso</option>
              <option value="current-year">Quest'anno</option>
              <option value="previous-year">Anno scorso</option>
              <option value="last-5-years">Ultimi 5 anni</option>
              <option value="all">Tutto il periodo</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Conto</label>
            <MultiSelectFilter
              label="Conto"
              options={sortAccountsPreferred(accounts).map((acc) => ({ value: acc.id, label: acc.name }))}
              selected={selectedAccountIds}
              onChange={setSelectedAccountIds}
            />
          </div>

          <div className="filter-group">
            <label>Categoria</label>
            <MultiSelectFilter
              label="Categoria"
              options={expenseTypes
                .filter((t) => !t.parentId)
                .map((type) => ({ value: type.id, label: type.name }))}
              selected={selectedTypeIds}
              onChange={setSelectedTypeIds}
            />
          </div>
        </div>

        {!movementsLoaded || isLoading ? (
          <div className="loading-state">Caricamento analisi...</div>
        ) : view === 'andamento' ? (
          balanceTrend.points.length > 0 ? (
            <BalanceTrendChart
              data={balanceTrend.points}
              openingBalance={balanceTrend.openingBalance}
            />
          ) : (
            <div className="empty-state">Nessun movimento nel periodo selezionato</div>
          )
        ) : filteredMovements.length === 0 && expectedOccurrences.length === 0 ? (
          <div className="empty-state">Nessun movimento nel periodo selezionato</div>
        ) : view === 'grafico' ? (
          isMonthView ? (
            <MonthBreakdownChart
              expensesByType={monthBreakdown.expensesByType}
              cashflowsByAccount={monthBreakdown.cashflowsByAccount}
              expenseTypes={expectedType}
              accounts={accounts}
            />
          ) : (
            <MovementsChart data={chartData} expenseTypes={expectedType} />
          )
        ) : (
          <>
            {/* Numerical Summary */}
            <div className="summary-section">
              <h2>Riepilogo</h2>
              <div className="summary-grid">
                <div className="summary-card">
                  <div className="summary-label">Totale Spese</div>
                  <div className="summary-value expense-value">
                    {abbreviateAmount(-summary.totalExpenses)}€
                  </div>
                  <div className="summary-meta">
                    {summary.expenseCount}{' '}
                    {summary.expenseCount === 1 ? 'transazione' : 'transazioni'}
                    {summary.expectedCount > 0 &&
                      ` + ${summary.expectedCount} previste`}
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-label">Totale Entrate</div>
                  <div className="summary-value cashflow-value">
                    +{abbreviateAmount(summary.totalCashflows)}€
                  </div>
                  <div className="summary-meta">{summary.cashflowCount} {summary.cashflowCount === 1 ? 'transazione' : 'transazioni'}</div>
                </div>

                <div className="summary-card">
                  <div className="summary-label">Media Spesa Giornaliera</div>
                  <div className="summary-value expense-value">
                    {abbreviateAmount(summary.avgExpense)}€
                  </div>
                  <div className="summary-meta">per giorno</div>
                </div>

                <div className="summary-card">
                  <div className="summary-label">Saldo</div>
                  <div
                    className="summary-value"
                    style={{
                      color:
                        summary.totalCashflows - summary.totalExpenses >= 0
                          ? '#22c55e'
                          : '#ef4444',
                    }}
                  >
                    {abbreviateAmount(summary.totalCashflows - summary.totalExpenses)}€
                  </div>
                  <div className="summary-meta">entrate - spese</div>
                </div>
              </div>
            </div>

            {/* Top Categories */}
            {summary.topCategories.length > 0 && (
              <div className="top-categories-section">
                <h2>Categorie Principali</h2>
                <div className="categories-list">
                  {summary.topCategories.map((category, index) => (
                    <div key={category.typeId} className="category-item">
                      <div className="category-rank">#{index + 1}</div>
                      <div className="category-info">
                        <div className="category-name">{category.typeName}</div>
                        <div className="category-amount">
                          {abbreviateAmount(-category.total)}€
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filtered Movements Report */}
            <div className="movements-section">
              <h2>Movimenti</h2>
              <div className="report-movements-list">
                {reportItems.map((item) => {
                  if (item.kind === 'expected') {
                    const occurrence: ExpectedOccurrence = item.occurrence;
                    const accountName = accounts.find(
                      (a) => a.id === occurrence.template.accountId
                    )?.name;
                    return (
                      <div
                        key={`expected-${occurrence.template.id}`}
                        className="movement-detail expected"
                      >
                        <div className="movement-detail-info">
                          <div className="report-movement-type">
                            {EXPECTED_EXPENSE_TYPE_LABEL}
                          </div>
                          <div className="movement-account">
                            {accountName} — {occurrence.template.name}
                          </div>
                          <div className="movement-date">
                            {formatDate(occurrence.dueDate)}
                          </div>
                        </div>
                        <div className="movement-amount expected">
                          -{abbreviateAmount(Math.abs(occurrence.amount))}€
                        </div>
                      </div>
                    );
                  }

                  const movement = item.movement;
                  const typeName =
                    movement.type === 'expense'
                      ? expenseTypes.find((et) => et.id === movement.expenseTypeId)?.name
                      : 'Entrata';
                  const accountName = accounts.find((a) => a.id === movement.accountId)?.name;

                  return (
                    <div
                      key={`${movement.type}-${movement.id}`}
                      className={`movement-detail ${movement.type}`}
                    >
                      <div className="movement-detail-info">
                        <div className="report-movement-type">{typeName || 'Sconosciuto'}</div>
                        <div className="movement-account">{accountName}</div>
                        <div className="movement-date">
                          {new Date(movement.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div
                        className={`movement-amount ${
                          movement.type === 'expense' ? 'expense' : 'cashflow'
                        }`}
                      >
                        {movement.type === 'expense' ? '-' : '+'}
                        {abbreviateAmount(Math.abs(movement.amount))}€
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
