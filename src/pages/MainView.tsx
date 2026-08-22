import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MovementFilters, DateRange } from '../types';
import { formatDate, abbreviateAmount, formatTime } from '../utils/formatting';
import Header from '../components/Header';
import '../styles/MainView.css';

export default function MainView() {
  const navigate = useNavigate();
  const { movements, loadMovements, isLoading, deleteExpense, deleteCashflow } = useApp();
  const [filters, setFilters] = useState<MovementFilters>({
    dateRange: 'current-month',
  });
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

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

  const handleMovementClick = (movementId: string, type: 'expense' | 'cashflow') => {
    if (type === 'expense') {
      navigate(`/expense/${movementId}/edit`);
    } else {
      navigate(`/cashflow/${movementId}/edit`);
    }
  };

  const handleDeleteMovement = async (movementId: string, type: 'expense' | 'cashflow') => {
    if (!confirm('Vuoi eliminare questo movimento?')) {
      return;
    }

    try {
      if (type === 'expense') {
        await deleteExpense(movementId);
      } else {
        await deleteCashflow(movementId);
      }
      loadMovements(filters);
    } catch (err) {
      console.error('Failed to delete movement:', err);
      alert('Errore durante l\'eliminazione del movimento');
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
      <Header
        title="💰 Gestione Spese"
        onNewExpense={handleNewExpense}
        onNewCashflow={handleNewCashflow}
      />

      <div className="main-content">
        <div className="actions-bar">
          <div className="date-filters">
            <button
              className={filters.dateRange === 'current-month' ? 'active' : ''}
              onClick={() => handleDateRangeChange('current-month')}
            >
              Questo mese
            </button>
            <button
              className={filters.dateRange === 'previous-month' ? 'active' : ''}
              onClick={() => handleDateRangeChange('previous-month')}
            >
              Mese scorso
            </button>
            <button
              className={filters.dateRange === 'current-year' ? 'active' : ''}
              onClick={() => handleDateRangeChange('current-year')}
            >
              Quest'anno
            </button>
            <button
              className={filters.dateRange === 'all' ? 'active' : ''}
              onClick={() => handleDateRangeChange('all')}
            >
              Tutti
            </button>
          </div>

          <div className="secondary-actions">
            <button className="btn-secondary" onClick={handleAnalytics}>
              📊 Analisi
            </button>
            <button className="btn-secondary" onClick={handleExpenseTypes}>
              🏷️ Categorie
            </button>
            <button className="btn-secondary" onClick={handleAccounts}>
              🏦 Conti
            </button>
          </div>
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
                <div key={movement.id} className="movement-item">
                  <li className="movement-content">
                    <div className="movement-info">
                      <div className="date">
                        {formatDate(movement.date)}
                        {movement.time && <span className="time">{formatTime(movement.time)}</span>}
                      </div>
                      <div className="type">
                        {movement.type === 'expense' ? '💸 Spesa' : '💰 Entrata'}
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
                    <div className="item-actions">
                      <button
                        className="action-btn"
                        onClick={() => handleMovementClick(movement.id, movement.type)}
                        title="Modifica"
                      >
                        ✏️
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteMovement(movement.id, movement.type)}
                        title="Elimina"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                </div>
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
