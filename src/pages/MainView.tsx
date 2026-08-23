import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MovementFilters, DateRange } from '../types';
import { formatDate, abbreviateAmount, formatTime } from '../utils/formatting';
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

  const handleMovementClick = (movementId: string, type: 'expense' | 'cashflow') => {
    if (type === 'expense') {
      navigate(`/expense/${movementId}/edit`);
    } else {
      navigate(`/cashflow/${movementId}/edit`);
    }
  };

  const paginatedMovements = movements.slice(0, (page + 1) * ITEMS_PER_PAGE);

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
            trigger={<FunnelIcon />}
            align="left"
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
        ) : movements.length === 0 ? (
          <div className="empty-state">
            <p>Nessun movimento</p>
            <p className="subtitle">Clicca "Nuova spesa" per iniziare</p>
          </div>
        ) : (
          <div className="movements-list-container" onScroll={handleScroll}>
            <ul className="movements-list">
              {paginatedMovements.map((movement) => (
                <li
                  key={movement.id}
                  className="movement-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleMovementClick(movement.id, movement.type)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleMovementClick(movement.id, movement.type);
                    }
                  }}
                >
                  <div className="movement-content">
                    <div className="movement-info">
                      <div className="date">
                        {formatDate(movement.date)}
                        {movement.time && <span className="time">{formatTime(movement.time)}</span>}
                      </div>
                      <div className="type">
                        {movement.type === 'expense'
                          ? `💸 ${expenseTypes.find((t) => t.id === movement.expenseTypeId)?.name || 'Spesa'}`
                          : movement.routingAccountId
                          ? `🔄 ${accounts.find((a) => a.id === movement.routingAccountId)?.name || '?'} → ${
                              accounts.find((a) => a.id === movement.accountId)?.name || '?'
                            }`
                          : `💰 ${accounts.find((a) => a.id === movement.accountId)?.name || '?'}`}
                      </div>
                    </div>
                    <div
                      className={`amount ${
                        movement.type === 'expense'
                          ? 'expense'
                          : movement.routingAccountId
                          ? 'routing'
                          : 'cashflow'
                      }`}
                    >
                      {movement.type === 'expense' && '-'}
                      {abbreviateAmount(movement.amount)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {paginatedMovements.length < movements.length && (
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
