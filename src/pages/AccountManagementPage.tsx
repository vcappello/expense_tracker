import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Account } from '../types';
import TitleBar from '../components/TitleBar';
import { abbreviateAmount } from '../utils/formatting';
import { sortAccountsPreferred } from '../utils/accounts';
import '../styles/ManagementPage.css';

export default function AccountManagementPage() {
  const navigate = useNavigate();
  const { accounts, loadAccounts, movements, cashflows, expenses, loadCashflows, loadExpenses, isLoading } = useApp();

  useEffect(() => {
    loadAccounts();
    loadCashflows();
    loadExpenses();
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
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
  };

  // Current balance = initial balance + net cashflows - expenses
  const getBalance = (account: Account): number => {
    const netCashflow = cashflows
      .filter((c) => c.accountId === account.id)
      .reduce((sum, c) => sum + c.amount, 0);
    const totalExpenses = expenses
      .filter((e) => e.accountId === account.id)
      .reduce((sum, e) => sum + e.amount, 0);
    return (account.initialBalance || 0) + netCashflow - totalExpenses;
  };

  return (
    <div className="management-page">
      <TitleBar
        title="Gestione Conti"
        actions={[{ content: '+ Crea Conto', label: 'Crea conto', kind: 'primary', onClick: handleCreate }]}
      />

      <main className="page-content">
        {isLoading && !accounts.length ? (
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
                        <span className="preferred-star" title="Conto preferito">
                          ★{' '}
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
