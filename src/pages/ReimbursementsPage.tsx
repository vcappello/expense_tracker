import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Expense } from '../types';
import TitleBar from '../components/TitleBar';
import { abbreviateAmount, formatDate, toDateTime } from '../utils/formatting';
import '../styles/ManagementPage.css';
import '../styles/ReimbursementsPage.css';

export default function ReimbursementsPage() {
  const navigate = useNavigate();
  const {
    accounts,
    expenseTypes,
    loadAccounts,
    loadExpenseTypes,
    getOutstandingReimbursableExpenses,
    isLoading,
    error: contextError,
  } = useApp();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
    loadExpenseTypes();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    getOutstandingReimbursableExpenses(today)
      .then(setExpenses)
      .catch((err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : 'Errore durante il caricamento dei rimborsi in attesa';
        setLoadError(message);
        console.error('Failed to load outstanding reimbursable expenses:', err);
      })
      .finally(() => setIsLoadingExpenses(false));
  }, [getOutstandingReimbursableExpenses, loadAccounts, loadExpenseTypes]);

  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort(
        (a, b) =>
          toDateTime(b.date, b.time).getTime() -
          toDateTime(a.date, a.time).getTime()
      ),
    [expenses]
  );
  const total = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses]
  );

  return (
    <div className="management-page">
      <TitleBar title="Rimborsi in attesa" />
      <main className="page-content reimbursements-content">
        {isLoadingExpenses || isLoading ? (
          <div className="loading-state">Caricamento rimborsi...</div>
        ) : loadError || contextError ? (
          <div className="empty-state" role="alert">
            {loadError || contextError}
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <p>Nessun rimborso in attesa</p>
            <p className="subtitle">
              Qui trovi le spese da rimborsare successive all’ultimo stipendio.
            </p>
          </div>
        ) : (
          <>
            <section className="reimbursements-summary" aria-label="Totale rimborsi in attesa">
              <span className="reimbursements-summary-label">Totale da rimborsare</span>
              <strong className="reimbursements-summary-total">
                {abbreviateAmount(total)}€
              </strong>
              <span className="reimbursements-summary-count">
                {expenses.length} {expenses.length === 1 ? 'spesa' : 'spese'}
              </span>
            </section>
            <p className="reimbursements-description">
              Spese contrassegnate come rimborsabili dopo l’ultimo stipendio registrato.
              {expenses.length > 0 &&
                ' Se non hai ancora registrato uno stipendio, vengono mostrate tutte.'}
            </p>
            <div className="items-list reimbursements-list">
              {sortedExpenses.map((expense) => (
                <button
                  type="button"
                  key={expense.id}
                  className="list-item reimbursement-item"
                  onClick={() => navigate(`/expense/${expense.id}/edit`)}
                  aria-label={`Modifica spesa ${expenseTypes.find((type) => type.id === expense.expenseTypeId)?.name || 'Sconosciuta'}, ${abbreviateAmount(-expense.amount)} euro`}
                >
                  <span className="item-main reimbursement-main">
                    <span className="item-name">
                      {expenseTypes.find((type) => type.id === expense.expenseTypeId)
                        ?.name || 'Categoria sconosciuta'}
                    </span>
                    <span className="item-meta reimbursement-meta">
                      <span>
                        {accounts.find((account) => account.id === expense.accountId)
                          ?.name || 'Conto sconosciuto'}
                      </span>
                      <span>{formatDate(expense.date)}</span>
                    </span>
                    {(expense.location || expense.notes) && (
                      <span className="reimbursement-note">
                        {expense.location && `📍 ${expense.location}`}
                        {expense.location && expense.notes && ' · '}
                        {expense.notes}
                      </span>
                    )}
                  </span>
                  <span className="reimbursement-amount">
                    −{abbreviateAmount(expense.amount)}€
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
