import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Account } from '../types';
import TitleBar from '../components/TitleBar';
import { abbreviateAmount, toDateTime } from '../utils/formatting';
import { sortAccountsPreferred } from '../utils/accounts';
import { getAccountBalance } from '../utils/accountBalance';
import '../styles/ManagementPage.css';

export default function AccountManagementPage() {
  const navigate = useNavigate();
  const {
    accounts,
    loadAccounts,
    movements,
    loadMovements,
    cashflows,
    expenses,
    loadCashflows,
    loadExpenses,
    accountBalanceAdjustments,
    loadAccountBalanceAdjustments,
    isLoading,
  } = useApp();
  const [adjustmentsLoaded, setAdjustmentsLoaded] = useState(false);

  useEffect(() => {
    loadAccounts();
    // Full range ('all') so the "last movement" per account is not scoped to
    // the Main view filter (the page does not apply a date filter of its own).
    loadMovements({ dateRange: 'all' });
    loadCashflows();
    loadExpenses();
    loadAccountBalanceAdjustments()
      .then(() => setAdjustmentsLoaded(true))
      .catch((err) => console.error('Failed to load account balance adjustments:', err));
  }, []);

  const handleCreate = () => {
    navigate('/account/new');
  };

  const handleEdit = (account: Account) => {
    navigate(`/account/${account.id}/edit`);
  };

  const sortedAccounts = sortAccountsPreferred(accounts);

  const getLastMovementForAccount = (accountId: string) => {
    const accountMovements = movements.filter((m) => m.accountId === accountId);
    if (accountMovements.length === 0) return null;
    return accountMovements.sort(
      (a, b) =>
        toDateTime(b.date, b.time).getTime() - toDateTime(a.date, a.time).getTime()
    )[0];
  };

  // Current balance = initial balance + net cashflows - expenses + adjustments
  // (shared formula, so the stash rule and the adjustments cannot diverge)
  const getBalance = (account: Account): number =>
    getAccountBalance(
      account,
      expenses.filter((expense) => expense.accountId === account.id),
      cashflows.filter((cashflow) => cashflow.accountId === account.id),
      accountBalanceAdjustments.filter(
        (adjustment) => adjustment.accountId === account.id
      )
    );

  return (
    <div className="management-page">
      <TitleBar
        title="Gestione Conti"
        actions={[{ content: '+ Crea Conto', label: 'Crea conto', kind: 'primary', onClick: handleCreate }]}
      />

      <main className="page-content">
        {(isLoading && !accounts.length) || !adjustmentsLoaded ? (
          <div className="loading-state">
            <p>Caricamento conti...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <p>Nessun conto</p>
            <p className="subtitle">Clicca "Crea" per aggiungerne uno</p>
          </div>
        ) : (
          <div className="items-list">
            {sortedAccounts.map((account) => {
              const lastMovement = getLastMovementForAccount(account.id);
              const balance = getBalance(account);
              return (
                <div
                  key={account.id}
                  className="list-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleEdit(account)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleEdit(account);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="item-main">
                    <div className="item-name">
                      {account.isPreferred && (
                        <span
                          className="preferred-star"
                          title={
                            account.isCoinAccount
                              ? 'Conto secondario predefinito'
                              : 'Conto principale predefinito'
                          }
                        >
                          ★{' '}
                        </span>
                      )}
                      {account.isCoinAccount && (
                        <span
                          className="secondary-account-badge"
                          title="Stash secondario non tracciato"
                        >
                          2°
                        </span>
                      )}
                      {account.name}
                    </div>
                    <div className="item-meta">
                      <span className="meta-saldo">
                        Saldo:{' '}
                        <span
                          className={`meta-amount ${balance >= 0 ? 'cashflow' : 'expense'}`}
                        >
                          {abbreviateAmount(balance)}€
                        </span>
                      </span>
                      {lastMovement && (
                        <span className="meta-date">
                          Ultimo: {new Date(lastMovement.date).toLocaleDateString()}{' '}
                          <span
                            className={`meta-amount ${
                              lastMovement.type === 'expense' ? 'expense' : 'cashflow'
                            }`}
                          >
                            {lastMovement.type === 'expense' ? '-' : '+'}
                            {abbreviateAmount(Math.abs(lastMovement.amount))}€
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
