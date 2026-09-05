import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Movement, MovementFilters, DateRange } from '../types';
import { formatDayHeader, formatMonthYear, abbreviateAmount, isToday } from '../utils/formatting';
import { routingCounterpartIds } from '../utils/routing';
import { exportDatabase, readBackupFile, BackupData } from '../utils/backup';
import TitleBar from '../components/TitleBar';
import ActionMenu from '../components/ActionMenu';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import Toast from '../components/Toast';
import { FunnelIcon, PlusIcon } from '../components/icons';
import '../styles/MainView.css';

export default function MainView() {
  const navigate = useNavigate();
  const { movements, loadMovements, isLoading, accounts, expenseTypes, loadAccounts, loadExpenseTypes, restoreBackup } = useApp();
  const [filters, setFilters] = useState<MovementFilters>({
    dateRange: 'current-month',
  });
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  // Backup / Restore state
  const [pendingImport, setPendingImport] = useState<BackupData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAccounts();
    loadExpenseTypes();
  }, []);

  useEffect(() => {
    loadMovements(filters);
  }, [filters]);

  // Auto-hide the confirmation toast after ~2.5s
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
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

  const handleExportBackup = async () => {
    try {
      await exportDatabase();
      setToast('Backup esportato');
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
      setToast('Backup ripristinato con successo');
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
              { label: '💾 Esporta backup', onClick: handleExportBackup },
              { label: '📥 Ripristina backup', onClick: () => fileInputRef.current?.click() },
            ]}
          />
        </div>

        {isLoading && !movements.length ? (
          <div className="loading-state">
            <p>Caricamento movimenti...</p>
          </div>
        ) : displayMovements.length === 0 ? (
          <div className="empty-state">
            <p>Nessun movimento</p>
            <p className="subtitle">Clicca "Nuova spesa" per iniziare</p>
          </div>
        ) : (
          <div ref={listRef} className="movements-list-container" onScroll={handleScroll}>
            <ul className="movements-list">
              {visibleGroups.map((group) => (
                <li key={group.key} className="day-group">
                  <div className="day-header">
                    {formatDayHeader(
                      group.date,
                      wideRange,
                      group.date.getFullYear() !== new Date().getFullYear()
                    )}
                    {isToday(group.date) && (
                      <span className="day-today">· Oggi</span>
                    )}
                  </div>
                  <ul className="day-movements">
                    {group.movements.map((movement) => {
                      const isExpense = movement.type === 'expense';
                      const isRouting =
                        movement.type === 'cashflow' &&
                        movement.routingAccountId != null;
                      const accountName =
                        accounts.find((a) => a.id === movement.accountId)?.name ||
                        '?';
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
                                {isExpense
                                  ? `💸 ${
                                      expenseTypes.find(
                                        (t) => t.id === movement.expenseTypeId
                                      )?.name || 'Spesa'
                                    } · ${accountName}`
                                  : isRouting
                                  ? `🔄 ${
                                      accounts.find(
                                        (a) =>
                                          a.id === movement.routingAccountId
                                      )?.name || '?'
                                    } → ${accountName}`
                                  : `💰 ${accountName}`}
                              </div>
                              {isExpense && movement.location && (
                                <div className="movement-place">
                                  📍 {movement.location}
                                </div>
                              )}
                            </div>
                            <div
                              className={`amount ${
                                isExpense
                                  ? 'expense'
                                  : isRouting
                                  ? 'routing'
                                  : 'cashflow'
                              }`}
                            >
                              {isExpense && '-'}
                              {abbreviateAmount(movement.amount)}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
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

      <Toast message={toast} />
    </div>
  );
}
