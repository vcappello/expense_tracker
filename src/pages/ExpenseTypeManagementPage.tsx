import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ExpenseType, DateRange } from '../types';
import TitleBar from '../components/TitleBar';
import { getDateRange, abbreviateAmount } from '../utils/formatting';
import '../styles/ManagementPage.css';

export default function ExpenseTypeManagementPage() {
  const navigate = useNavigate();
  const { expenseTypes, loadExpenseTypes, movements, isLoading } = useApp();
  const [dateRange, setDateRange] = useState<DateRange>('current-month');
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadExpenseTypes();
  }, []);

  const handleCreate = () => {
    navigate('/expense-type/new');
  };

  const handleEdit = (type: ExpenseType) => {
    navigate(`/expense-type/${type.id}/edit`);
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
      <TitleBar
        title="Gestione Categorie"
        actions={[{ content: '+ Crea Categoria', label: 'Crea categoria', kind: 'primary', onClick: handleCreate }]}
      />

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
                    <div
                      className="list-item"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleEdit(type)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleEdit(type);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="item-main">
                        <div className="item-name">
                          {childTypes.length > 0 && (
                            <span
                              className="chevron"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(type.id);
                              }}
                            >
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
                            <div
                              key={child.id}
                              className="list-item"
                              role="button"
                              tabIndex={0}
                              onClick={() => handleEdit(child)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') handleEdit(child);
                              }}
                              style={{ marginBottom: '8px', cursor: 'pointer' }}
                            >
                              <div className="item-main">
                                <div className="item-name">{child.name}</div>
                                <div className="item-meta">
                                  <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                    {abbreviateAmount(-childTotal)}€
                                  </span>
                                </div>
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
      </main>
    </div>
  );
}
