import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Movement, MovementFilters, DateRange } from '../types';
import { formatDayHeader, formatMonthYear, abbreviateAmount, isToday, formatDate } from '../utils/formatting';
import { routingCounterpartIds } from '../utils/routing';
import { ExpectedOccurrence, getExpectedOccurrences, getFrequencyLabel } from '../utils/recurrence';
import { exportDatabase, readBackupFile, BackupData } from '../utils/backup';
import TitleBar from '../components/TitleBar';
import ActionMenu from '../components/ActionMenu';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import Toast from '../components/Toast';
import { FunnelIcon, PlusIcon } from '../components/icons';
import '../styles/MainView.css';
// Frequency badge of the expected (recurring) rows: defined once in
// RecurringPage.css and imported here explicitly (CSS is global).
import '../styles/RecurringPage.css';

export default function MainView() {
  const navigate = useNavigate();
  const { movements, loadMovements, isLoading, accounts, expenseTypes, loadAccounts, loadExpenseTypes, restoreBackup, recurringExpenses, loadRecurringExpenses, confirmRecurringOccurrences, lastRecurringConfirmation, undoLastRecurringConfirmation, clearLastRecurringConfirmation } = useApp();
  const [filters, setFilters] = useState<MovementFilters>({
    dateRange: 'current-month',
  });
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  // Backup / Restore state
  const [pendingImport, setPendingImport] = useState<BackupData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    icon?: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAccounts();
    loadExpenseTypes();
    loadRecurringExpenses();
  }, []);

  useEffect(() => {
    loadMovements(filters);
  }, [filters]);

  // Auto-hide the confirmation toast after ~2.5s
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
      clearLastRecurringConfirmation();
    }, toast.actionLabel ? 5000 : 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleDateRangeChange = (range: DateRange) => {
    setFilters({ ...filters, dateRange: range });
    setPage(0);
  };

  const handleNewExpense = () => {
    navigate('/expense/new');
  };

  const handleNewCashflow = () => {
    navigate('/cashflow/new');
  };

  const handleAnalytics = () => {
    navigate('/analytics');
  };

  const handleExpenseTypes = () => {
    navigate('/expense-types');
  };

  const handleAccounts = () => {
    navigate('/accounts');
  };

  const handleRecurring = () => {
    navigate('/recurring');
  };

  const handleExportBackup = async () => {
    try {
      await exportDatabase();
      setToast({ message: 'Backup esportato' });
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Errore durante l'esportazione del backup"
      );
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be selected again
    e.target.value = '';
    if (!file) return;
    try {
      const data = await readBackupFile(file);
      setPendingImport(data);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Errore durante la lettura del file'
      );
    }
  };

  const handleRestoreConfirm = async () => {
    if (!pendingImport) return;
    try {
      await restoreBackup(pendingImport);
      // Reload the movement list with the restored data
      await loadMovements(filters);
      setPendingImport(null);
      setToast({ message: 'Backup ripristinato con successo' });
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Errore durante il ripristino del backup'
      );
    }
  };

  const dateRangeOptions: { label: string; value: DateRange }[] = [
    { label: 'Mese corrente', value: 'current-month' },
    { label: 'Mese scorso', value: 'previous-month' },
    { label: "Quest'anno", value: 'current-year' },
    { label: 'Tutti', value: 'all' },
  ];

  const handleMovementClick = (movement: Movement) => {
    if (movement.type === 'expense') {
      navigate(`/expense/${movement.id}/edit`);
      return;
    }
    // If the routing receiving leg belongs to a coin-split expense (an Expense
    // in the list shares the same routingPairId), open the expense edit
    // instead of the cashflow edit.
    if (movement.routingPairId) {
      const linkedExpense = movements.find(
        (m) =>
          m.type === 'expense' && m.routingPairId === movement.routingPairId
      );
      if (linkedExpense) {
        navigate(`/expense/${linkedExpense.id}/edit`);
        return;
      }
    }
    navigate(`/cashflow/${movement.id}/edit`);
  };

  // Display: hide routing counterparts (negative legs) and coin-split internal
  // incomes, keeping only the receiving leg (yellow) visible.
  const hiddenCashflowIds = useMemo(
    () => routingCounterpartIds(movements.filter((m) => m.type === 'cashflow')),
    [movements]
  );
  const displayMovements = movements.filter(
    (m) => m.type === 'expense' || !hiddenCashflowIds.has(m.id)
  );

  // Single-month ranges get a compact day header; Quest'anno/Tutti show the
  // full month name (and the year when the day is not in the current year).
  const wideRange =
    filters.dateRange === 'current-year' || filters.dateRange === 'all';

  // Label of the active date range shown in the Filters pill (e.g. the month
  // and year for single-month ranges, the year for Quest'anno, 'Tutti').
  const filterValue = (() => {
    const now = new Date();
    switch (filters.dateRange) {
      case 'current-month':
        return formatMonthYear(now);
      case 'previous-month':
        return formatMonthYear(
          new Date(now.getFullYear(), now.getMonth() - 1, 1)
        );
      case 'current-year':
        return String(now.getFullYear());
      default:
        return 'Tutti';
    }
  })();

  // Expected (not yet confirmed) occurrences of the recurring expenses. They
  // are shown only in the ranges that contain today, right after the "today"
  // group and before the older days; the section is never paginated.
  const rangeIncludesToday =
    filters.dateRange === 'current-month' ||
    filters.dateRange === 'current-year' ||
    filters.dateRange === 'all';

  const expectedOccurrences = useMemo(
    () => (rangeIncludesToday ? getExpectedOccurrences(recurringExpenses) : []),
    [recurringExpenses, rangeIncludesToday]
  );

  // Group the (already date/time-desc sorted) movements by calendar day.
  const dayGroups = useMemo(() => {
    const groups: { key: string; date: Date; movements: Movement[] }[] = [];
    const byKey = new Map<
      string,
      { key: string; date: Date; movements: Movement[] }
    >();
    for (const m of displayMovements) {
      const d = new Date(
        m.date.getFullYear(),
        m.date.getMonth(),
        m.date.getDate()
      );
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let group = byKey.get(key);
      if (!group) {
        group = { key, date: d, movements: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.movements.push(m);
    }
    return groups;
  }, [displayMovements]);

  // Pagination by whole day groups: a page boundary never cuts a day, so the
  // visible prefix always ends at a day boundary. When a boundary falls inside
  // a day, the whole day group is deferred to the following page.
  const visibleGroupCount = useMemo(() => {
    const target = (page + 1) * ITEMS_PER_PAGE;
    let cumulative = 0;
    let count = 0;
    for (const g of dayGroups) {
      if (cumulative + g.movements.length > target) break;
      cumulative += g.movements.length;
      count += 1;
    }
    // A single day larger than a page is still shown whole (never split).
    if (count === 0 && dayGroups.length > 0) count = 1;
    return count;
  }, [dayGroups, page]);

  const visibleGroups = dayGroups.slice(0, visibleGroupCount);
  const hasMore = visibleGroupCount < dayGroups.length;

  // When the loaded whole-day groups do not yet fill the scroll container the
  // user could never scroll to trigger the next load: auto-load more groups.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = listRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) {
      setPage((prev) => prev + 1);
    }
  }, [hasMore, visibleGroups]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    if (
      element.scrollHeight - element.scrollTop < element.clientHeight + 100
    ) {
      setPage((prev) => prev + 1);
    }
  };

  /** Confirm every expected occurrence at once (default amount, now). */
  const handleConfirmAll = async () => {
    if (expectedOccurrences.length === 0) return;
    try {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      await confirmRecurringOccurrences(
        expectedOccurrences.map((occurrence) => ({
          recurringId: occurrence.template.id,
          amount: occurrence.amount,
          date: now,
          time,
        }))
      );
      // The created Expenses are dated today: refresh the list
      await loadMovements(filters);
    } catch (err) {
      console.error('Failed to confirm the expected occurrences:', err);
      setImportError('Errore durante la conferma delle spese previste');
    }
  };

  // Undo of a recurring confirmation: deleting the created Expense un-consumes
  // the period, so the expected occurrence is proposed again.
  const handleUndoRecurring = async () => {
    try {
      await undoLastRecurringConfirmation();
      await loadMovements(filters);
      setToast(null);
    } catch (err) {
      console.error('Failed to undo the recurring confirmation:', err);
    }
  };

  useEffect(() => {
    if (!lastRecurringConfirmation) return;
    const count = lastRecurringConfirmation.expenseIds.length;
    setToast({
      message: lastRecurringConfirmation.name
        ? `Spesa confermata: ${lastRecurringConfirmation.name}`
        : `${count} spese confermate`,
      actionLabel: 'Annulla',
      onAction: handleUndoRecurring,
    });
    // Only when a new confirmation happens (handleUndoRecurring uses the
    // current filter, which is fine: it must refresh the visible list).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRecurringConfirmation]);

  // The expected section goes right after the "today" day group (the groups are
  // ordered most recent first, so today is the first one when it exists).
  const firstGroupIsToday =
    visibleGroups.length > 0 && isToday(visibleGroups[0].date);
  const headGroups = firstGroupIsToday ? visibleGroups.slice(0, 1) : [];
  const restGroups = firstGroupIsToday ? visibleGroups.slice(1) : visibleGroups;

  const renderMovementRow = (movement: Movement) => {
    const isExpense = movement.type === 'expense';
    const isRouting =
      movement.type === 'cashflow' && movement.routingAccountId != null;
    const accountName =
      accounts.find((a) => a.id === movement.accountId)?.name || '?';
    return (
      <li
        key={movement.id}
        className="movement-item"
        role="button"
        tabIndex={0}
        onClick={() => handleMovementClick(movement)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleMovementClick(movement);
          }
        }}
      >
        <div className="movement-content">
          <div className="movement-info">
            <div className="movement-type">
              <span className="movement-type-label">
                {isExpense
                  ? `💸 ${
                      expenseTypes.find((t) => t.id === movement.expenseTypeId)
                        ?.name || 'Spesa'
                    } · ${accountName}`
                  : isRouting
                  ? `🔄 ${
                      accounts.find(
                        (a) => a.id === movement.routingAccountId
                      )?.name || '?'
                    } → ${accountName}`
                  : `💰 ${accountName}`}
              </span>
              {isExpense && movement.reimbursable && (
                <span className="reimbursable-badge">da rimborsare</span>
              )}
            </div>
            {isExpense && movement.location && (
              <div className="movement-place">📍 {movement.location}</div>
            )}
          </div>
          <div
            className={`amount ${
              isExpense ? 'expense' : isRouting ? 'routing' : 'cashflow'
            }`}
          >
            {isExpense && '-'}
            {abbreviateAmount(movement.amount)}
          </div>
        </div>
      </li>
    );
  };

  const renderDayGroup = (group: {
    key: string;
    date: Date;
    movements: Movement[];
  }) => (
    <li key={group.key} className="day-group">
      <div className="day-header">
        {formatDayHeader(
          group.date,
          wideRange,
          group.date.getFullYear() !== new Date().getFullYear()
        )}
        {isToday(group.date) && <span className="day-today">· Oggi</span>}
      </div>
      <ul className="day-movements">
        {group.movements.map(renderMovementRow)}
      </ul>
    </li>
  );

  const expectedSection =
    expectedOccurrences.length > 0 ? (
      <li className="day-group expected-group">
        <div className="day-header expected-header">
          <span>Spese previste</span>
          {expectedOccurrences.length > 1 && (
            <button
              type="button"
              className="expected-confirm-all"
              onClick={handleConfirmAll}
              disabled={isLoading}
            >
              Conferma tutte
            </button>
          )}
        </div>
        <ul className="day-movements">
          {expectedOccurrences.map((occurrence: ExpectedOccurrence) => {
            const accountName =
              accounts.find((a) => a.id === occurrence.template.accountId)
                ?.name || '?';
            const typeName =
              expenseTypes.find(
                (t) => t.id === occurrence.template.expenseTypeId
              )?.name || 'Spesa';
            return (
              <li
                key={occurrence.template.id}
                className="movement-item expected-item"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/recurring/${occurrence.template.id}/confirm`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(`/recurring/${occurrence.template.id}/confirm`);
                  }
                }}
              >
                <div className="movement-content">
                  <div className="movement-info">
                    <div className="movement-type expected-type">
                      <span className="movement-type-label">
                        🔁 {occurrence.template.name}
                      </span>
                      <span className="frequency-badge">
                        {getFrequencyLabel(occurrence.template.frequency)}
                      </span>
                    </div>
                    <div className="movement-place">
                      💸 {typeName} · {accountName} — prevista{' '}
                      {formatDate(occurrence.dueDate)}
                    </div>
                  </div>
                  <div className="amount expected">
                    {abbreviateAmount(occurrence.amount)}€
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </li>
    ) : null;

  return (
    <div className="main-view">
      <TitleBar
        title="💰 Gestione Spese"
        showBack={false}
        actions={[
          {
            content: (
              <>
                <PlusIcon /> Spesa
              </>
            ),
            label: 'Nuova spesa',
            kind: 'primary',
            onClick: handleNewExpense,
          },
          {
            content: (
              <>
                <PlusIcon /> Entrata
              </>
            ),
            label: 'Nuova entrata',
            kind: 'primary',
            onClick: handleNewCashflow,
          },
        ]}
      />

      <div className="main-content">
        <div className="actions-bar">
          <ActionMenu
            triggerLabel="Filtri"
            trigger={
              <>
                <FunnelIcon />
                <span className="filter-value">{filterValue}</span>
              </>
            }
            align="left"
            className="filter-menu"
            items={dateRangeOptions.map((opt) => ({
              label: opt.label,
              active: filters.dateRange === opt.value,
              onClick: () => handleDateRangeChange(opt.value),
            }))}
          />
          <ActionMenu
            triggerLabel="Azioni"
            items={[
              { label: '📊 Analisi', onClick: handleAnalytics },
              { label: '🏦 Conti', onClick: handleAccounts },
              { label: '🏷️ Categorie', onClick: handleExpenseTypes },
              { label: '🔁 Ricorrenti', onClick: handleRecurring },
              { label: '💾 Esporta backup', onClick: handleExportBackup },
              { label: '📥 Ripristina backup', onClick: () => fileInputRef.current?.click() },
            ]}
          />
        </div>

        {isLoading && !movements.length ? (
          <div className="loading-state">
            <p>Caricamento movimenti...</p>
          </div>
        ) : displayMovements.length === 0 && expectedOccurrences.length === 0 ? (
          <div className="empty-state">
            <p>Nessun movimento</p>
            <p className="subtitle">Clicca "Nuova spesa" per iniziare</p>
          </div>
        ) : (
          <div ref={listRef} className="movements-list-container" onScroll={handleScroll}>
            <ul className="movements-list">
              {headGroups.map(renderDayGroup)}
              {expectedSection}
              {restGroups.map(renderDayGroup)}
            </ul>

            {hasMore && (
              <div className="load-more">
                <p>Scorri per altri...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input for the backup restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <ConfirmModal
        open={pendingImport !== null}
        title="Ripristina backup"
        confirmLabel="Ripristina"
        lines={
          pendingImport ? (
            <div className="restore-info">
              <p>
                Il ripristino <strong>sostituirà tutti i dati</strong> attuali con
                quelli del file di backup.
              </p>
              <ul>
                <li>{pendingImport.accounts.length} conti</li>
                <li>{pendingImport.expenseTypes.length} categorie</li>
                <li>{pendingImport.expenses.length} spese</li>
                <li>{pendingImport.cashflows.length} entrate</li>
                <li>
                  {pendingImport.recurringExpenses.length} spese ricorrenti
                </li>
              </ul>
            </div>
          ) : null
        }
        onConfirm={handleRestoreConfirm}
        onCancel={() => setPendingImport(null)}
      />

      <AlertModal
        open={importError !== null}
        message={importError}
        onClose={() => setImportError(null)}
      />

      <Toast
        message={toast?.message ?? null}
        icon={toast?.icon}
        actionLabel={toast?.actionLabel}
        onAction={toast?.onAction}
      />
    </div>
  );
}
