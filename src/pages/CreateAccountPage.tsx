import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp, AccountDeleteInfo } from '../context/AppContext';
import { Account } from '../types';
import TitleBar, { TitleBarAction } from '../components/TitleBar';
import { CheckIcon, TrashIcon } from '../components/icons';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/EntityForm.css';

export default function CreateAccountPage() {
  const navigate = useNavigate();
  const { id: accountId } = useParams<{ id: string }>();
  const { createAccount, updateAccount, getAccount, getAccountDeleteInfo, deleteAccountCascade } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    initialBalance: '',
    isPreferred: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [deleteInfo, setDeleteInfo] = useState<AccountDeleteInfo | null>(null);

  // Pre-populate form when editing an existing account
  useEffect(() => {
    const loadAccount = async () => {
      if (!accountId) return;
      try {
        const account = await getAccount(accountId);
        if (account) {
          setFormData({
            name: account.name,
            initialBalance: account.initialBalance ? String(account.initialBalance) : '',
            isPreferred: account.isPreferred === true,
          });
        }
      } catch (err) {
        console.error('Failed to load account:', err);
      }
    };

    loadAccount();
  }, [accountId, getAccount]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
  };

  const handleInitialBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({ ...prev, initialBalance: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Inserisci il nome del conto');
      return;
    }

    try {
      setIsLoading(true);
      const now = new Date();
      const initialBalance = parseFloat(formData.initialBalance) || 0;

      if (accountId) {
        const existing = await getAccount(accountId);
        if (existing) {
          await updateAccount({
            ...existing,
            name: formData.name,
            initialBalance,
            isPreferred: formData.isPreferred,
            updatedAt: now,
          });
        }
      } else {
        const newAccount: Account = {
          id: Date.now().toString(),
          name: formData.name,
          initialBalance,
          isPreferred: formData.isPreferred,
          createdAt: now,
          updatedAt: now,
        };
        await createAccount(newAccount);
      }

      navigate('/accounts');
    } catch (err) {
      console.error('Failed to save account:', err);
      alert('Errore durante il salvataggio del conto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!accountId) return;
    try {
      const info = await getAccountDeleteInfo(accountId);
      setDeleteInfo(info);
    } catch (err) {
      console.error('Failed to load account delete info:', err);
      alert('Errore durante il caricamento dei dati');
    }
  };

  const confirmDelete = async () => {
    if (!accountId) return;
    try {
      await deleteAccountCascade(accountId);
      setDeleteInfo(null);
      navigate('/accounts');
    } catch (err) {
      console.error('Failed to delete account:', err);
      alert('Errore durante l\'eliminazione del conto');
    }
  };

  const closeDeleteModal = () => setDeleteInfo(null);

  const titleBarActions: TitleBarAction[] = [];
  if (accountId) {
    titleBarActions.push({
      content: <TrashIcon />,
      label: 'Elimina',
      kind: 'danger',
      iconOnly: true,
      onClick: handleDelete,
      disabled: isLoading,
    });
  }
  titleBarActions.push({
    content: <CheckIcon />,
    label: accountId ? 'Aggiorna' : 'Crea',
    kind: 'primary',
    iconOnly: true,
    onClick: () => formRef.current?.requestSubmit(),
    disabled: isLoading,
  });

  return (
    <div className="entity-page">
      <TitleBar
        title={accountId ? 'Modifica Conto' : 'Crea Conto'}
        actions={titleBarActions}
      />

      <main className="entity-content">
        <form ref={formRef} className="entity-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Nome Conto *</label>
            <input
              type="text"
              id="name"
              placeholder="es. Contanti, Conto bancario"
              value={formData.name}
              onChange={handleNameChange}
              className="form-input"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="initialBalance">Giacenza iniziale (€)</label>
            <input
              type="text"
              id="initialBalance"
              inputMode="decimal"
              placeholder="0.00"
              value={formData.initialBalance}
              onChange={handleInitialBalanceChange}
              className="form-input"
            />
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label" htmlFor="isPreferred">
              <input
                type="checkbox"
                id="isPreferred"
                checked={formData.isPreferred}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isPreferred: e.target.checked }))
                }
              />
              Conto preferito (visualizzato per primo nell'inserimento spese)
            </label>
          </div>

          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
        </form>
      </main>

      <ConfirmModal
        open={!!deleteInfo}
        title="Elimina Conto"
        lines={
          deleteInfo &&
          (deleteInfo.expensesCount > 0 || deleteInfo.cashflowsCount > 0) ? (
            <>
              Questo conto ha:
              <br />• {deleteInfo.cashflowsCount} {deleteInfo.cashflowsCount === 1 ? 'entrata' : 'entrate'} per{' '}
              {Math.abs(deleteInfo.cashflowsTotal).toFixed(2)}€
              <br />• {deleteInfo.expensesCount} {deleteInfo.expensesCount === 1 ? 'spesa' : 'spese'} per{' '}
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
