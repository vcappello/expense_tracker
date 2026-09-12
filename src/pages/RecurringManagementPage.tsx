import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { RecurringExpense } from '../types';
import TitleBar from '../components/TitleBar';
import { abbreviateAmount, formatDate } from '../utils/formatting';
import { getFrequencyLabel, getNextDueDate } from '../utils/recurrence';
import '../styles/ManagementPage.css';
import '../styles/RecurringPage.css';

/**
 * Management of the recurring expense templates (spec.md → "Recurring
 * expenses"). Rows are clickable and open the Edit view; Delete lives in the
 * edit view (like Accounts/Categories).
 */
export default function RecurringManagementPage() {
  const navigate = useNavigate();
  const {
    recurringExpenses,
    loadRecurringExpenses,
    expenseTypes,
    loadExpenseTypes,
    accounts,
    loadAccounts,
    isLoading,
  } = useApp();

  useEffect(() => {
    loadRecurringExpenses();
    loadExpenseTypes();
    loadAccounts();
  }, []);

  const handleCreate = () => navigate('/recurring/new');
  const handleEdit = (recurring: RecurringExpense) =>
    navigate(`/recurring/${recurring.id}/edit`);

  // Active templates first, then by name
  const sorted = [...recurringExpenses].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const typeName = (id: string) =>
    expenseTypes.find((t) => t.id === id)?.name ?? '?';
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? '?';

  return (
    <div className="management-page">
      <TitleBar
        title="Spese ricorrenti"
        actions={[
          {
            content: '+ Crea ricorrenza',
            label: 'Crea ricorrenza',
            kind: 'primary',
            onClick: handleCreate,
          },
        ]}
      />

      <main className="page-content">
        {isLoading && !recurringExpenses.length ? (
          <div className="loading-state">
            <p>Caricamento ricorrenze...</p>
          </div>
        ) : recurringExpenses.length === 0 ? (
          <div className="empty-state">
            <p>Nessuna ricorrenza</p>
            <p className="subtitle">
              Clicca "Crea ricorrenza" per aggiungerne una
            </p>
          </div>
        ) : (
          <div className="items-list">
            {sorted.map((recurring) => (
              <div
                key={recurring.id}
                className="list-item"
                role="button"
                tabIndex={0}
                onClick={() => handleEdit(recurring)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleEdit(recurring);
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="item-main">
                  <div className="item-name">
                    {recurring.name}
                    <span className="frequency-badge">
                      🔁 {getFrequencyLabel(recurring.frequency)}
                    </span>
                    {!recurring.active && (
                      <span className="paused-badge">in pausa</span>
                    )}
                  </div>
                  <div className="item-meta recurring-meta">
                    <span className="meta-date">
                      Prossima:{' '}
                      {formatDate(
                        getNextDueDate(recurring.frequency, recurring.startDate)
                      )}
                    </span>
                    <span>
                      {typeName(recurring.expenseTypeId)} ·{' '}
                      {accountName(recurring.accountId)}
                    </span>
                    <span className="meta-amount expense">
                      {abbreviateAmount(recurring.amount)}€
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
