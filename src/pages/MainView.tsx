import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MovementFilters, DateRange } from '../types';
import { formatDate, abbreviateAmount, formatTime } from '../utils/formatting';
import TitleBar from '../components/TitleBar';
import ActionMenu from '../components/ActionMenu';
import { FunnelIcon, PlusIcon } from '../components/icons';
import '../styles/MainView.css';

export default function MainView() {
  const navigate = useNavigate();
  const { movements, loadMovements, isLoading, accounts, expenseTypes, loadAccounts, loadExpenseTypes } = useApp();
  const [filters, setFilters] = useState<MovementFilters>({
    dateRange: 'current-month',
  });
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadAccounts();
    loadExpenseTypes();
  }, []);

  useEffect(() => {
    loadMovements(filters);
  }, [filters]);

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
    </div>
  );
}
