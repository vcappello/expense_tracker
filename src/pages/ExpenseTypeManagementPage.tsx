import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, ExpenseTypeDeleteInfo } from '../context/AppContext';
import { ExpenseType, DateRange } from '../types';
import Header from '../components/Header';
import ConfirmModal from '../components/ConfirmModal';
import { getDateRange, abbreviateAmount } from '../utils/formatting';
import '../styles/ManagementPage.css';

export default function ExpenseTypeManagementPage() {
  const navigate = useNavigate();
  const { expenseTypes, loadExpenseTypes, movements, isLoading, getExpenseTypeDeleteInfo, deleteExpenseTypeCascade, loadMovements } = useApp();
  const [dateRange, setDateRange] = useState<DateRange>('current-month');
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<ExpenseType | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<ExpenseTypeDeleteInfo | null>(null);

  useEffect(() => {
    loadExpenseTypes();
  }, []);

  const handleCreate = () => {
    navigate('/expense-type/new');
  };

  const handleEdit = (type: ExpenseType) => {
    navigate(`/expense-type/${type.id}/edit`);
  };

  const handleDelete = async (type: ExpenseType) => {
    try {
      const info = await getExpenseTypeDeleteInfo(type.id);
      setDeleteInfo(info);
      setDeleteTarget(type);
    } catch (err) {
      console.error('Failed to load category delete info:', err);
      alert('Errore durante il caricamento dei dati');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteExpenseTypeCascade(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteInfo(null);
      await loadExpenseTypes();
      await loadMovements({ dateRange: 'all' });
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert('Errore durante l\'eliminazione della categoria');
    }
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteInfo(null);
  };

  const toggleExpand = (typeId: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) {
        next.delete(typeId);
      } else {
        next.add(typeId);
      }
      return next;
    });
  };

  // Collect the type id plus all descendant type ids (recursive hierarchy)
  const getDescendantIds = (typeId: string): string[] => {
    const ids = [typeId];
    expenseTypes
      .filter((t) => t.parentId === typeId)
      .forEach((child) => {
        ids.push(...getDescendantIds(child.id));
      });
    return ids;
  };

  // Calculate total amount for each category in the selected period,
  // including all expenses of the same hierarchy at any level
  const getCategoryTotal = (typeId: string): number => {
    const { start, end } = getDateRange(dateRange);
    const typeIds = new Set(getDescendantIds(typeId));
    return movements
      .filter(
        (m) =>
          m.type === 'expense' &&
          typeIds.has(m.expenseTypeId) &&
          new Date(m.date) >= start &&
          new Date(m.date) <= end
      )
      .reduce((sum, m) => sum + m.amount, 0);
  };

  // Get root categories
  const rootCategories = expenseTypes.filter((t) => !t.parentId);

  return (
    <div className="management-page">
      <Header title="Gestione Categorie" showBack={true} />

      <main className="page-content">
        {isLoading && !expenseTypes.length ? (
          <div className="loading-state">
            <p>Caricamento categorie...</p>
          </div>
        ) : expenseTypes.length === 0 ? (
          <div className="empty-state">
            <p>Nessuna categoria</p>
            <p className="subtitle">Clicca "Crea" per aggiungerne una</p>
          </div>
        ) : (
          <>
            {/* Date Range Filter */}
            <div className="filter-bar" style={{ marginBottom: '24px' }}>
              <label htmlFor="dateRange" style={{ color: '#cbd5e1', marginRight: '8px' }}>
                Periodo:
              </label>
              <select
                id="dateRange"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  color: '#e5eefb',
                  cursor: 'pointer',
                }}
              >
                <option value="current-month">Questo mese</option>
                <option value="previous-month">Mese scorso</option>
                <option value="current-year">Quest'anno</option>
                <option value="all">Tutto il periodo</option>
              </select>
            </div>

            <div className="items-list">
              {rootCategories.map((type) => {
                const childTypes = expenseTypes.filter((t) => t.parentId === type.id);
                const total = getCategoryTotal(type.id);
                const isExpanded = expandedTypes.has(type.id);

                return (
                  <div key={type.id}>
                    <div className="list-item">
                      <div
                        className="item-main"
                        onClick={() => toggleExpand(type.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="item-name">
                          {childTypes.length > 0 && (
                            <span className="chevron">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          )}
                          {type.name}
                        </div>
                        <div className="item-meta">
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>
                            {abbreviateAmount(-total)}€
                          </span>
                          {childTypes.length > 0 && (
                            <span style={{ color: '#a5b4cf', fontSize: '0.85rem' }}>
                              ({childTypes.length} sottocategorie)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="item-actions">
                        <button
                          className="action-btn"
                          onClick={() => handleEdit(type)}
                          title="Modifica"
                        >
                          ✏️
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleDelete(type)}
                          title="Elimina"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Child Categories (shown only when expanded) */}
                    {childTypes.length > 0 && isExpanded && (
                      <div
                        style={{
                          marginLeft: '16px',
                          marginTop: '8px',
                          marginBottom: '12px',
                          borderLeft: '2px solid rgba(148, 163, 184, 0.2)',
                          paddingLeft: '16px',
                        }}
                      >
                        {childTypes.map((child) => {
                          const childTotal = getCategoryTotal(child.id);
                          return (
                            <div key={child.id} className="list-item" style={{ marginBottom: '8px' }}>
                              <div className="item-main">
                                <div className="item-name">{child.name}</div>
                                <div className="item-meta">
                                  <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                    {abbreviateAmount(-childTotal)}€
                                  </span>
                                </div>
                              </div>

                              <div className="item-actions">
                                <button
                                  className="action-btn"
                                  onClick={() => handleEdit(child)}
                                  title="Modifica"
                                >
                                  ✏️
                                </button>
                                <button
                                  className="action-btn delete"
                                  onClick={() => handleDelete(child)}
                                  title="Elimina"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Create Button */}
        <div className="floating-button">
          <button className="btn-primary-large" onClick={handleCreate}>
            + Crea Categoria
          </button>
        </div>
      </main>

      <ConfirmModal
        open={!!deleteTarget}
        title="Elimina Categoria"
        lines={
          deleteInfo &&
          (deleteInfo.expensesCount > 0 || deleteInfo.childCount > 0) ? (
            <>
              Questa categoria ha:
              <br />• {deleteInfo.expensesCount} spesa{deleteInfo.expensesCount === 1 ? '' : 'e'} per{' '}
              {Math.abs(deleteInfo.expensesTotal).toFixed(2)}€
              <br />• {deleteInfo.childCount} sottocategoria{deleteInfo.childCount === 1 ? '' : 'e'}
              <br />
              <br />
              Tutte le spese e le sottocategorie collegate verranno eliminate.
            </>
          ) : (
            <>Eliminare questa categoria?</>
          )
        }
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
}
