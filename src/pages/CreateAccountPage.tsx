import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useApp, AccountDeleteInfo } from '../context/AppContext';
import { Account, AccountBalanceAdjustment } from '../types';
import TitleBar, { TitleBarAction } from '../components/TitleBar';
import { CheckIcon, TrashIcon } from '../components/icons';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import AlertModal from '../components/AlertModal';
import Modal from '../components/Modal';
import { useNavigateBack } from '../utils/navigation';
import { formatCurrency } from '../utils/formatting';
import { v4 as uuidv4 } from 'uuid';
import '../styles/EntityForm.css';
import '../styles/AccountAdjustments.css';

interface AdjustmentDraft {
  id?: string;
  date: string;
  observedBalance: string;
  notes: string;
}

const localDateInputValue = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const parseAmount = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const toLocalDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function CreateAccountPage() {
  const navigateBack = useNavigateBack('/accounts');
  const { id: accountId } = useParams<{ id: string }>();
  const {
    createAccount,
    updateAccount,
    getAccount,
    getAccountDeleteInfo,
    deleteAccountCascade,
    accountBalanceAdjustments,
    loadAccountBalanceAdjustments,
    getAccountBalanceAtDate,
    createAccountBalanceAdjustment,
    updateAccountBalanceAdjustment,
    deleteAccountBalanceAdjustment,
  } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    initialBalance: '',
    isPreferred: false,
    isCoinAccount: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [deleteInfo, setDeleteInfo] = useState<AccountDeleteInfo | null>(null);
  const [toast, setToast] = useState<{ message: string; icon?: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [adjustmentDraft, setAdjustmentDraft] = useState<AdjustmentDraft | null>(
    null
  );
  const [previewBalance, setPreviewBalance] = useState<number | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [pendingAdjustmentDelete, setPendingAdjustmentDelete] =
    useState<AccountBalanceAdjustment | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);

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
            isCoinAccount: account.isCoinAccount === true,
          });
        }
      } catch (err) {
        console.error('Failed to load account:', err);
      }
    };

    loadAccount();
  }, [accountId, getAccount]);

  useEffect(() => {
    if (!accountId) return;
    loadAccountBalanceAdjustments(accountId).catch((err) => {
      console.error('Failed to load account balance adjustments:', err);
      setAlertMessage('Errore durante il caricamento dello storico rettifiche');
    });
  }, [accountId, loadAccountBalanceAdjustments]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    getAccountBalanceAtDate(accountId, new Date())
      .then((balance) => {
        if (!cancelled) setCurrentBalance(balance);
      })
      .catch((err) => {
        console.error('Failed to load current account balance:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [accountBalanceAdjustments, accountId, getAccountBalanceAtDate]);

  const adjustmentDate = adjustmentDraft?.date;
  const adjustmentId = adjustmentDraft?.id;

  useEffect(() => {
    if (!accountId || !adjustmentDate) {
      setPreviewBalance(null);
      return;
    }
    let cancelled = false;
    setPreviewBalance(null);
    setIsLoadingPreview(true);
    getAccountBalanceAtDate(
      accountId,
      toLocalDate(adjustmentDate),
      adjustmentId
    )
      .then((balance) => {
        if (!cancelled) setPreviewBalance(balance);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to calculate balance adjustment preview:', err);
          setPreviewBalance(null);
          setAlertMessage('Errore durante il calcolo del saldo del conto');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, adjustmentDate, adjustmentId, getAccountBalanceAtDate]);

  // Show a transient toast (default success ✅, pass ⚠️ for warnings), resetting any pending timer
  const showToast = (message: string, icon = '✅') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, icon });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  // Clear the toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

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
      showToast('Inserisci il nome del conto', '⚠️');
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
            isCoinAccount: formData.isCoinAccount,
            updatedAt: now,
          });
        }
      } else {
        const newAccount: Account = {
          id: uuidv4(),
          name: formData.name,
          initialBalance,
          isPreferred: formData.isPreferred,
          isCoinAccount: formData.isCoinAccount,
          createdAt: now,
          updatedAt: now,
        };
        await createAccount(newAccount);
      }

      navigateBack();
    } catch (err) {
      console.error('Failed to save account:', err);
      setAlertMessage('Errore durante il salvataggio del conto');
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
      setAlertMessage('Errore durante il caricamento dei dati');
    }
  };

  const confirmDelete = async () => {
    if (!accountId) return;
    try {
      await deleteAccountCascade(accountId);
      setDeleteInfo(null);
      navigateBack();
    } catch (err) {
      console.error('Failed to delete account:', err);
      setAlertMessage('Errore durante l\'eliminazione del conto');
    }
  };

  const closeDeleteModal = () => setDeleteInfo(null);

  const openAdjustment = async (adjustment?: AccountBalanceAdjustment) => {
    const date = adjustment ? new Date(adjustment.date) : new Date();
    let observedBalance = '';
    if (adjustment && accountId) {
      try {
        const balanceWithoutAdjustment = await getAccountBalanceAtDate(
          accountId,
          date,
          adjustment.id
        );
        observedBalance = String(
          Math.round((balanceWithoutAdjustment + adjustment.amount) * 100) / 100
        );
      } catch (err) {
        console.error('Failed to load balance adjustment:', err);
        setAlertMessage('Errore durante il caricamento della rettifica');
        return;
      }
    }
    setAdjustmentDraft({
      id: adjustment?.id,
      date: localDateInputValue(date),
      observedBalance,
      notes: adjustment?.notes ?? '',
    });
  };

  const handleSaveAdjustment = async () => {
    if (!accountId || !adjustmentDraft || previewBalance === null) return;
    const observedBalance = parseAmount(adjustmentDraft.observedBalance);
    if (observedBalance === null) {
      setAlertMessage('Inserisci il saldo effettivo osservato');
      return;
    }
    if (!adjustmentDraft.date) {
      setAlertMessage('Seleziona la data della rettifica');
      return;
    }

    const amount =
      Math.round((observedBalance - previewBalance) * 100) / 100;
    const now = new Date();
    const adjustment: AccountBalanceAdjustment = {
      id: adjustmentDraft.id ?? uuidv4(),
      accountId,
      date: toLocalDate(adjustmentDraft.date),
      amount,
      notes: adjustmentDraft.notes.trim(),
      createdAt:
        accountBalanceAdjustments.find((item) => item.id === adjustmentDraft.id)
          ?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      setIsSavingAdjustment(true);
      if (adjustmentDraft.id) {
        await updateAccountBalanceAdjustment(adjustment);
      } else {
        await createAccountBalanceAdjustment(adjustment);
      }
      setAdjustmentDraft(null);
      showToast('Rettifica salvata');
    } catch (err) {
      console.error('Failed to save account balance adjustment:', err);
      setAlertMessage('Errore durante il salvataggio della rettifica');
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const handleDeleteAdjustment = async () => {
    if (!pendingAdjustmentDelete) return;
    try {
      await deleteAccountBalanceAdjustment(pendingAdjustmentDelete.id);
      setPendingAdjustmentDelete(null);
      showToast('Rettifica eliminata');
    } catch (err) {
      console.error('Failed to delete account balance adjustment:', err);
      setAlertMessage("Errore durante l'eliminazione della rettifica");
    }
  };

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
        <form ref={formRef} className="entity-form" onSubmit={handleSubmit} noValidate>
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

          <div className="form-group checkbox-group">
            <label className="checkbox-label" htmlFor="isCoinAccount">
              <input
                type="checkbox"
                id="isCoinAccount"
                checked={formData.isCoinAccount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isCoinAccount: e.target.checked }))
                }
              />
              Conto monete (usato come conto per le monete nelle spese)
            </label>
          </div>

          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
        </form>

        {accountId && (
          <section className="balance-adjustment-panel">
            <div className="balance-adjustment-heading">
              <div>
                <h2>Rettifiche di saldo</h2>
                <p>
                  Saldo attuale:{' '}
                  <strong>
                    {currentBalance === null
                      ? 'Caricamento...'
                      : formatCurrency(currentBalance)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                className="balance-adjustment-add"
                onClick={() => void openAdjustment()}
              >
                Riallinea saldo
              </button>
            </div>

            {accountBalanceAdjustments.filter(
              (item) => item.accountId === accountId
            ).length === 0 ? (
              <p className="balance-adjustment-empty">Nessuna rettifica registrata</p>
            ) : (
              <ul className="balance-adjustment-list">
                {accountBalanceAdjustments
                  .filter((item) => item.accountId === accountId)
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                  )
                  .map((adjustment) => (
                    <li key={adjustment.id}>
                      <button
                        type="button"
                        className="balance-adjustment-entry"
                        onClick={() => void openAdjustment(adjustment)}
                      >
                        <span>
                          <strong>
                            {new Date(adjustment.date).toLocaleDateString('it-IT')}
                          </strong>
                          {adjustment.notes && <small>{adjustment.notes}</small>}
                        </span>
                        <strong
                          className={
                            adjustment.amount >= 0
                              ? 'balance-adjustment-positive'
                              : 'balance-adjustment-negative'
                          }
                        >
                          {adjustment.amount > 0 ? '+' : ''}
                          {formatCurrency(adjustment.amount)}
                        </strong>
                      </button>
                      <button
                        type="button"
                        className="balance-adjustment-delete"
                        onClick={() => setPendingAdjustmentDelete(adjustment)}
                        aria-label="Elimina rettifica"
                      >
                        Elimina
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        )}
      </main>

      <ConfirmModal
        open={!!deleteInfo}
        title="Elimina Conto"
        lines={
          deleteInfo &&
          (deleteInfo.expensesCount > 0 ||
            deleteInfo.cashflowsCount > 0 ||
            deleteInfo.recurringCount > 0 ||
            deleteInfo.balanceAdjustmentsCount > 0) ? (
            <>
              Questo conto ha:
              {deleteInfo.cashflowsCount > 0 && (
                <>
                  <br />• {deleteInfo.cashflowsCount}{' '}
                  {deleteInfo.cashflowsCount === 1 ? 'entrata' : 'entrate'} per{' '}
                  {Math.abs(deleteInfo.cashflowsTotal).toFixed(2)}€
                </>
              )}
              {deleteInfo.expensesCount > 0 && (
                <>
                  <br />• {deleteInfo.expensesCount}{' '}
                  {deleteInfo.expensesCount === 1 ? 'spesa' : 'spese'} per{' '}
                  {Math.abs(deleteInfo.expensesTotal).toFixed(2)}€
                </>
              )}
              {deleteInfo.recurringCount > 0 && (
                <>
                  <br />• {deleteInfo.recurringCount}{' '}
                  {deleteInfo.recurringCount === 1
                    ? 'spesa ricorrente'
                    : 'spese ricorrenti'}
                </>
              )}
              {deleteInfo.balanceAdjustmentsCount > 0 && (
                <>
                  <br />• {deleteInfo.balanceAdjustmentsCount}{' '}
                  {deleteInfo.balanceAdjustmentsCount === 1
                    ? 'rettifica di saldo'
                    : 'rettifiche di saldo'}
                </>
              )}
              <br />
              <br />
              Tutti i movimenti, le rettifiche e le ricorrenze collegate verranno eliminati.
            </>
          ) : (
            <>Eliminare questo conto?</>
          )
        }
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
      />

      <Modal
        open={adjustmentDraft !== null}
        title={adjustmentDraft?.id ? 'Modifica rettifica' : 'Riallinea saldo'}
        className="balance-adjustment-modal"
        onClose={() => setAdjustmentDraft(null)}
        actions={
          <>
            {adjustmentDraft?.id && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  const adjustment = accountBalanceAdjustments.find(
                    (item) => item.id === adjustmentDraft.id
                  );
                  if (adjustment) setPendingAdjustmentDelete(adjustment);
                  setAdjustmentDraft(null);
                }}
              >
                Elimina
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAdjustmentDraft(null)}
            >
              Annulla
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={isSavingAdjustment || isLoadingPreview || previewBalance === null}
              onClick={() => void handleSaveAdjustment()}
            >
              {isSavingAdjustment ? 'Salvataggio...' : 'Salva'}
            </button>
          </>
        }
      >
        {adjustmentDraft && (
          <div className="balance-adjustment-form">
            <div className="form-group">
              <label htmlFor="adjustment-date">Data del riallineamento</label>
              <input
                id="adjustment-date"
                className="form-input"
                type="date"
                value={adjustmentDraft.date}
                onChange={(event) =>
                  setAdjustmentDraft((draft) =>
                    draft ? { ...draft, date: event.target.value } : draft
                  )
                }
              />
            </div>
            <div className="balance-adjustment-balance">
              Saldo calcolato dall'app:{' '}
              <strong>
                {isLoadingPreview || previewBalance === null
                  ? 'Calcolo...'
                  : formatCurrency(previewBalance)}
              </strong>
            </div>
            <div className="form-group">
              <label htmlFor="observed-balance">Saldo effettivo osservato (€)</label>
              <input
                id="observed-balance"
                className="form-input"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={adjustmentDraft.observedBalance}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === '' || /^-?\d*(?:[.,]\d*)?$/.test(value)) {
                    setAdjustmentDraft((draft) =>
                      draft ? { ...draft, observedBalance: value } : draft
                    );
                  }
                }}
              />
            </div>
            {parseAmount(adjustmentDraft.observedBalance) !== null &&
              previewBalance !== null && (
                <p className="balance-adjustment-difference">
                  Differenza da applicare:{' '}
                  <strong
                    className={
                      parseAmount(adjustmentDraft.observedBalance)! - previewBalance >= 0
                        ? 'balance-adjustment-positive'
                        : 'balance-adjustment-negative'
                    }
                  >
                    {formatCurrency(
                      parseAmount(adjustmentDraft.observedBalance)! - previewBalance
                    )}
                  </strong>
                </p>
              )}
            <div className="form-group">
              <label htmlFor="adjustment-notes">Nota (facoltativa)</label>
              <textarea
                id="adjustment-notes"
                className="form-input"
                rows={2}
                placeholder="es. Verifica estratto conto"
                value={adjustmentDraft.notes}
                onChange={(event) =>
                  setAdjustmentDraft((draft) =>
                    draft ? { ...draft, notes: event.target.value } : draft
                  )
                }
              />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={pendingAdjustmentDelete !== null}
        title="Elimina rettifica"
        lines="Il saldo del conto verrà ricalcolato senza questa rettifica."
        confirmLabel="Elimina"
        onConfirm={() => void handleDeleteAdjustment()}
        onCancel={() => setPendingAdjustmentDelete(null)}
      />

      <Toast message={toast?.message ?? null} icon={toast?.icon} />

      <AlertModal
        open={!!alertMessage}
        message={alertMessage}
        onClose={() => setAlertMessage(null)}
      />
    </div>
  );
}
