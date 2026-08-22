import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Account } from '../types';
import TitleBar from '../components/TitleBar';
import { abbreviateAmount } from '../utils/formatting';
import '../styles/ManagementPage.css';

export default function AccountManagementPage() {
  const navigate = useNavigate();
  const { accounts, loadAccounts, movements, isLoading } = useApp();

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleCreate = () => {
    navigate('/account/new');
  };

  const handleEdit = (account: Account) => {
    navigate(`/account/${account.id}/edit`);
  };

  const getLastMovementForAccount = (accountId: string) => {
    const accountMovements = movements.filter((m) => m.accountId === accountId);
    if (accountMovements.length === 0) return null;
    return accountMovements.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
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
            {accounts.map((account) => {
              const lastMovement = getLastMovementForAccount(account.id);
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
                    <div className="item-name">{account.name}</div>
                    {lastMovement && (
                      <div className="item-meta">
                        <span className="meta-date">
                          {new Date(lastMovement.date).toLocaleDateString()}
                        </span>
                        <span
                          className={`meta-amount ${
                            lastMovement.type === 'expense' ? 'expense' : 'cashflow'
                          }`}
                        >
                          {lastMovement.type === 'expense' ? '-' : '+'}
                          {abbreviateAmount(Math.abs(lastMovement.amount))}€
                        </span>
                      </div>
                    )}
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
