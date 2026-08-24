import { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DateRange } from '../types';
import TitleBar from '../components/TitleBar';
import MultiSelectFilter from '../components/MultiSelectFilter';
import MovementsChart, { DailyTotal } from '../components/MovementsChart';
import MonthBreakdownChart from '../components/MonthBreakdownChart';
import { getDateRange, abbreviateAmount, formatCurrency, formatDate } from '../utils/formatting';
import { sortAccountsPreferred } from '../utils/accounts';
import { isRoutingCashflow, routingCounterpartIds } from '../utils/routing';
import { exportMovementsToCSV } from '../utils/csv';
import '../styles/AnalyticsPage.css';

export default function AnalyticsPage() {
  const { accounts, expenseTypes, movements, isLoading } = useApp();
  const [dateRange, setDateRange] = useState<DateRange>('current-month');
  // Empty array = no filter (all)
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [view, setView] = useState<'report' | 'grafico'>('report');

  // Filter movements based on selected filters
  const filteredMovements = useMemo(() => {
    const { start, end } = getDateRange(dateRange);

    // Expand selected categories to include their descendants (hierarchy)
    const collectDescendants = (typeId: string, acc: Set<string>): void => {
      acc.add(typeId);
      expenseTypes
        .filter((t) => t.parentId === typeId)
        .forEach((child) => collectDescendants(child.id, acc));
    };
    const expandedTypeIds = new Set<string>();
    selectedTypeIds.forEach((id) => collectDescendants(id, expandedTypeIds));

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
  }, [movements, dateRange, selectedTypeIds, selectedAccountIds, expenseTypes]);

  // Separate expenses and cashflows
  const expenses = useMemo(() => filteredMovements.filter((m) => m.type === 'expense'), [filteredMovements]);
  const cashflows = useMemo(() => filteredMovements.filter((m) => m.type === 'cashflow'), [filteredMovements]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const nonRoutingCashflows = cashflows.filter((c) => !isRoutingCashflow(c, cashflows));
    const totalCashflows = nonRoutingCashflows.reduce((sum, c) => sum + c.amount, 0);

    // Average daily expense = total expenses / number of days in the selected period
    const { start, end } = getDateRange(dateRange);
    const daysInPeriod =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const avgExpense = daysInPeriod > 0 ? totalExpenses / daysInPeriod : 0;

    // Top 3 categories
    const categoryTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryTotals[e.expenseTypeId] = (categoryTotals[e.expenseTypeId] || 0) + e.amount;
    });

    const topCategories = Object.entries(categoryTotals)
      .map(([typeId, total]) => ({
        typeId,
        typeName: expenseTypes.find((et) => et.id === typeId)?.name || 'Sconosciuto',
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    return {
      totalExpenses,
      totalCashflows,
      avgExpense,
      expenseCount: expenses.length,
      cashflowCount: nonRoutingCashflows.length,
      topCategories,
    };
  }, [expenses, cashflows, expenseTypes, dateRange]);

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

    return Object.values(byDay);
  }, [filteredMovements, cashflows]);

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
    return {
      expensesByType: Object.entries(byType).map(([typeId, total]) => ({ typeId, total })),
      cashflowsByAccount: Object.entries(byAccount).map(([accountId, total]) => ({
        accountId,
        total,
      })),
    };
  }, [filteredMovements, cashflows]);

  // Movements shown in the report list / CSV export: same display rule as the
  // Main view (hide routing counterparts and coin-split internal incomes),
  // while the summary totals still count the internal income (option A).
  const reportMovements = useMemo(() => {
    const hiddenCashflowIds = routingCounterpartIds(cashflows);
    return filteredMovements.filter(
      (m) => m.type === 'expense' || !hiddenCashflowIds.has(m.id)
    );
  }, [filteredMovements, cashflows]);

  const isMonthView = dateRange === 'current-month' || dateRange === 'previous-month';

  return (
    <div className="analytics-page">
      <TitleBar
        title="Analisi"
        actions={[
          {
            content: '📋 Report',
            label: 'Report',
            kind: 'toggle',
            active: view === 'report',
            onClick: () => setView('report'),
          },
          {
            content: '📊 Grafico',
            label: 'Grafico',
            kind: 'toggle',
            active: view === 'grafico',
            onClick: () => setView('grafico'),
          },
        ]}
        menu={[
          {
            label: 'Esporta CSV',
            onClick: () => exportMovementsToCSV(reportMovements, accounts, expenseTypes),
            disabled: reportMovements.length === 0,
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

        {isLoading ? (
          <div className="loading-state">Caricamento analisi...</div>
        ) : filteredMovements.length === 0 ? (
          <div className="empty-state">Nessun movimento nel periodo selezionato</div>
        ) : view === 'grafico' ? (
          isMonthView ? (
            <MonthBreakdownChart
              expensesByType={monthBreakdown.expensesByType}
              cashflowsByAccount={monthBreakdown.cashflowsByAccount}
              expenseTypes={expenseTypes}
              accounts={accounts}
            />
          ) : (
            <MovementsChart data={chartData} expenseTypes={expenseTypes} />
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
                  <div className="summary-meta">{summary.expenseCount} {summary.expenseCount === 1 ? 'transazione' : 'transazioni'}</div>
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
              <div className="movements-list">
                {[...reportMovements]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((movement) => {
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
                          <div className="movement-type">{typeName || 'Sconosciuto'}</div>
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
