import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../context/AppContext';
import { RecurrenceFrequency, RecurringExpense } from '../types';
import TitleBar, { TitleBarAction } from '../components/TitleBar';
import { CheckIcon, TrashIcon } from '../components/icons';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import Toast from '../components/Toast';
import { formatDate } from '../utils/formatting';
import { sortAccountsPreferred } from '../utils/accounts';
import { FREQUENCY_OPTIONS, getNextDueDate } from '../utils/recurrence';
import { useNavigateBack } from '../utils/navigation';
import '../styles/EntityForm.css';
import '../styles/RecurringPage.css';

const toInputDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const fromInputDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

/**
 * Create/Edit a recurring expense template (spec.md → "Recurring expenses").
 */
export default function CreateRecurringPage() {
  const navigateBack = useNavigateBack('/recurring');
  const { id: recurringId } = useParams<{ id: string }>();
  const {
    accounts,
    loadAccounts,
    expenseTypes,
    loadExpenseTypes,
    getRecurringExpense,
    createRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
  } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    frequency: 'monthly' as RecurrenceFrequency,
    amount: '',
    expenseTypeId: '',
    accountId: '',
    startDate: toInputDate(new Date()),
    notes: '',
    location: '',
    reimbursable: false,
    paused: false,
  });
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ message: string; icon?: string } | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    loadAccounts();
    loadExpenseTypes();
  }, []);

  const showToast = (message: string, icon = '✅') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, icon });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Defaults: first preferred account, first category
  useEffect(() => {
    if (recurringId || loaded) return;
    setFormData((prev) => ({
      ...prev,
      accountId: prev.accountId || sortAccountsPreferred(accounts)[0]?.id || '',
      expenseTypeId: prev.expenseTypeId || expenseTypes[0]?.id || '',
    }));
  }, [accounts, expenseTypes, recurringId, loaded]);

  // Pre-populate the form when editing
  useEffect(() => {
    const load = async () => {
      if (!recurringId) return;
      try {
        const recurring = await getRecurringExpense(recurringId);
        if (recurring) {
          setFormData({
            name: recurring.name,
            frequency: recurring.frequency,
            amount: String(recurring.amount),
            expenseTypeId: recurring.expenseTypeId,
            accountId: recurring.accountId,
            startDate: toInputDate(recurring.startDate),
            notes: recurring.notes,
            location: recurring.location,
            reimbursable: recurring.reimbursable,
            paused: !recurring.active,
          });
        }
        setLoaded(true);
      } catch (err) {
        console.error('Failed to load recurring expense:', err);
        setAlertMessage('Errore durante il caricamento della ricorrenza');
      }
    };
    load();
  }, [recurringId, getRecurringExpense]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({ ...prev, amount: value }));
    }
  };

  const nextDueDate = formData.startDate
    ? getNextDueDate(formData.frequency, fromInputDate(formData.startDate))
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(formData.amount);
    if (!formData.name.trim()) {
      showToast('Inserisci un nome per la ricorrenza', '⚠️');
      return;
    }
    if (!amount || amount <= 0) {
      showToast('Inserisci un importo valido', '⚠️');
      return;
    }
    if (!formData.expenseTypeId) {
      showToast('Seleziona una categoria', '⚠️');
      return;
    }
    if (!formData.accountId) {
      showToast('Seleziona un conto', '⚠️');
      return;
    }
    if (!formData.startDate) {
      showToast('Inserisci la data di inizio', '⚠️');
      return;
    }

    try {
      setIsLoading(true);
      const now = new Date();
      const startDate = fromInputDate(formData.startDate);

      if (recurringId) {
        const existing = await getRecurringExpense(recurringId);
        if (!existing) throw new Error('Ricorrenza non trovata');
        await updateRecurringExpense({
          ...existing,
          name: formData.name.trim(),
          frequency: formData.frequency,
          amount,
          expenseTypeId: formData.expenseTypeId,
          accountId: formData.accountId,
          startDate,
          notes: formData.notes,
          location: formData.location,
          reimbursable: formData.reimbursable,
          active: !formData.paused,
          updatedAt: now,
        });
      } else {
        const recurring: RecurringExpense = {
          id: uuidv4(),
          name: formData.name.trim(),
          frequency: formData.frequency,
          amount,
          expenseTypeId: formData.expenseTypeId,
          accountId: formData.accountId,
          startDate,
          active: !formData.paused,
          notes: formData.notes,
          location: formData.location,
          reimbursable: formData.reimbursable,
          lastConfirmedPeriod: null,
          lastConfirmedExpenseId: null,
          skippedPeriod: null,
          createdAt: now,
          updatedAt: now,
        };
        await createRecurringExpense(recurring);
      }

      navigateBack();
    } catch (err) {
      console.error('Failed to save recurring expense:', err);
      setAlertMessage('Errore durante il salvataggio della ricorrenza');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!recurringId) return;
    try {
      await deleteRecurringExpense(recurringId);
      setConfirmDelete(false);
      navigateBack();
    } catch (err) {
      console.error('Failed to delete recurring expense:', err);
      setAlertMessage("Errore durante l'eliminazione della ricorrenza");
    }
  };

  const titleBarActions: TitleBarAction[] = [];
  if (recurringId) {
    titleBarActions.push({
      content: <TrashIcon />,
      label: 'Elimina',
      kind: 'danger',
      iconOnly: true,
      onClick: () => setConfirmDelete(true),
      disabled: isLoading,
    });
  }
  titleBarActions.push({
    content: <CheckIcon />,
    label: recurringId ? 'Aggiorna' : 'Crea',
    kind: 'primary',
    iconOnly: true,
    onClick: () => formRef.current?.requestSubmit(),
    disabled: isLoading,
  });

  return (
    <div className="entity-page">
      <TitleBar
        title={recurringId ? 'Modifica Ricorrenza' : 'Crea Ricorrenza'}
        actions={titleBarActions}
      />

      <main className="entity-content">
        <form ref={formRef} className="entity-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Nome *</label>
            <input
              type="text"
              id="name"
              placeholder="es. Affitto, Palestra, Bolletta luce"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="form-input"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="frequency">Ricorrenza *</label>
            <select
              id="frequency"
              value={formData.frequency}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  frequency: e.target.value as RecurrenceFrequency,
                }))
              }
              className="form-input"
              required
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="amount">Importo (€) *</label>
            <input
              type="text"
              id="amount"
              inputMode="decimal"
              placeholder="0.00"
              value={formData.amount}
              onChange={handleAmountChange}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="expenseTypeId">Categoria *</label>
            <select
              id="expenseTypeId"
              value={formData.expenseTypeId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, expenseTypeId: e.target.value }))
              }
              className="form-input"
              required
            >
              <option value="">Seleziona categoria</option>
              {expenseTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="accountId">Conto *</label>
            <select
              id="accountId"
              value={formData.accountId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, accountId: e.target.value }))
              }
              className="form-input"
              required
            >
              <option value="">Seleziona conto</option>
              {sortAccountsPreferred(accounts).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="startDate">Data di inizio *</label>
            <input
              type="date"
              id="startDate"
              value={formData.startDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, startDate: e.target.value }))
              }
              className="form-input"
              required
            />
            {nextDueDate && (
              <p className="recurring-due-preview">
                Prossima scadenza: {formatDate(nextDueDate)}
              </p>
            )}
          </div>

          <div className="recurring-form-section">
            <h3>Informazioni aggiuntive (opzionale)</h3>

            <div className="form-group">
              <label htmlFor="notes">Note</label>
              <textarea
                id="notes"
                className="form-textarea"
                rows={2}
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">Luogo</label>
              <input
                type="text"
                id="location"
                placeholder="es. Via Roma 1, Milano"
                value={formData.location}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, location: e.target.value }))
                }
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label" htmlFor="reimbursable">
              <input
                type="checkbox"
                id="reimbursable"
                checked={formData.reimbursable}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    reimbursable: e.target.checked,
                  }))
                }
              />
              Sarà rimborsata
            </label>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label" htmlFor="paused">
              <input
                type="checkbox"
                id="paused"
                checked={formData.paused}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, paused: e.target.checked }))
                }
              />
              In pausa (non propone la spesa)
            </label>
          </div>

          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
        </form>
      </main>

      <ConfirmModal
        open={confirmDelete}
        title="Elimina Ricorrenza"
        lines={
          <>
            La spesa non verrà più proposta.
            <br />
            Le spese già confermate restano invariate.
          </>
        }
        confirmLabel="Elimina"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDelete(false)}
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
