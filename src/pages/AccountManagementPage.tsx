import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, AccountDeleteInfo } from '../context/AppContext';
import { Account } from '../types';
import Header from '../components/Header';
import ConfirmModal from '../components/ConfirmModal';
import { abbreviateAmount } from '../utils/formatting';
import '../styles/ManagementPage.css';

export default function AccountManagementPage() {
  const navigate = useNavigate();
  const { accounts, loadAccounts, movements, isLoading, getAccountDeleteInfo, deleteAccountCascade, loadMovements } = useApp();
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<AccountDeleteInfo | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleCreate = () => {
    navigate('/account/new');
  };

  const handleEdit = (account: Account) => {
    navigate(`/account/${account.id}/edit`);
  };

  const handleDelete = async (account: Account) => {
    try {
      const info = await getAccountDeleteInfo(account.id);
      setDeleteInfo(info);
      setDeleteTarget(account);
    } catch (err) {
      console.error('Failed to load account delete info:', err);
      alert('Errore durante il caricamento dei dati');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteAccountCascade(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteInfo(null);
      await loadAccounts();
      await loadMovements({ dateRange: 'all' });
    } catch (err) {
      console.error('Failed to delete account:', err);
      alert('Errore durante l\'eliminazione del conto');
    }
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteInfo(null);
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
      <Header title="Gestione Conti" showBack={true} />

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
                <div key={account.id} className="list-item">
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

                  <div className="item-actions">
                    <button
                      className="action-btn"
                      onClick={() => handleEdit(account)}
                      title="Modifica"
                    >
                      ✏️
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(account)}
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

        {/* Create Button */}
        <div className="floating-button">
          <button className="btn-primary-large" onClick={handleCreate}>
            + Crea Conto
          </button>
        </div>
      </main>

      <ConfirmModal
        open={!!deleteTarget}
        title="Elimina Conto"
        lines={
          deleteInfo &&
          (deleteInfo.expensesCount > 0 || deleteInfo.cashflowsCount > 0) ? (
            <>
              Questo conto ha:
              <br />• {deleteInfo.cashflowsCount} entrata{deleteInfo.cashflowsCount === 1 ? '' : 'e'} per{' '}
              {Math.abs(deleteInfo.cashflowsTotal).toFixed(2)}€
              <br />• {deleteInfo.expensesCount} spesa{deleteInfo.expensesCount === 1 ? '' : 'e'} per{' '}
              {Math.abs(deleteInfo.expensesTotal).toFixed(2)}€
              <br />
              <br />
              Tutti i movimenti collegati verranno eliminati.
            </>
          ) : (
            <>Eliminare questo conto?</>
          )
        }
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
}
