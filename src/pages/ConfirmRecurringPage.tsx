import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { RecurringExpense } from '../types';
import TitleBar, { TitleBarAction } from '../components/TitleBar';
import { CheckIcon, TrashIcon } from '../components/icons';
import Modal from '../components/Modal';
import AlertModal from '../components/AlertModal';
import Toast from '../components/Toast';
import { sortAccountsPreferred } from '../utils/accounts';
import { getFrequencyLabel, getPeriodKey } from '../utils/recurrence';
import { useNavigateBack } from '../utils/navigation';
import '../styles/EntityForm.css';
import '../styles/RecurringPage.css';

const toInputDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const formatTimeToHHMMSS = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(
    date.getSeconds()
  ).padStart(2, '0')}`;

/**
 * Confirmation (and edit) of an expected occurrence of a recurring expense
 * (spec.md → "Recurring expenses"). Confirming creates a normal Expense dated
 * at the chosen date/time; if the amount differs from the template default the
 * user chooses whether the change applies to this occurrence only or to all the
 * following ones. The Delete action offers "Salta questa" (skip the period) or
 * "Interrompi la ricorrenza" (delete the template).
 */
export default function ConfirmRecurringPage() {
  const navigateBack = useNavigateBack('/');
  const { id: recurringId } = useParams<{ id: string }>();
  const {
    accounts,
    loadAccounts,
    expenseTypes,
    loadExpenseTypes,
    getRecurringExpense,
    updateRecurringExpense,
    confirmRecurringOccurrence,
    skipRecurringOccurrence,
    deleteRecurringExpense,
  } = useApp();

  const [template, setTemplate] = useState<RecurringExpense | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toInputDate(new Date()));
  const [time, setTime] = useState(formatTimeToHHMMSS(new Date()));
  const [isLoading, setIsLoading] = useState(false);
  // Pending amount waiting for the "this one / all the following" choice
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [askDelete, setAskDelete] = useState(false);
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

  useEffect(() => {
    const load = async () => {
      if (!recurringId) return;
      try {
        const recurring = await getRecurringExpense(recurringId);
        if (!recurring) {
          setAlertMessage('Ricorrenza non trovata');
          return;
        }
        // Guard: do not confirm a period already consumed (e.g. stale page)
        if (
          recurring.lastConfirmedPeriod ===
          getPeriodKey(recurring.frequency, new Date())
        ) {
          setAlertMessage(
            'Questa ricorrenza è già stata confermata per il periodo corrente.'
          );
          return;
        }
        setTemplate(recurring);
        setAmount(String(recurring.amount));
      } catch (err) {
        console.error('Failed to load recurring expense:', err);
        setAlertMessage('Errore durante il caricamento della ricorrenza');
      }
    };
    load();
  }, [recurringId, getRecurringExpense]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) setAmount(value);
  };

  /**
   * Confirm the occurrence. `alsoUpdateTemplate` = the amount change applies to
   * all the following occurrences too ("Tutte le successive").
   */
  const doConfirm = async (value: number, alsoUpdateTemplate: boolean) => {
    if (!template) return;
    try {
      setIsLoading(true);
      if (alsoUpdateTemplate) {
        await updateRecurringExpense({
          ...template,
          amount: value,
          updatedAt: new Date(),
        });
      }
      await confirmRecurringOccurrence({
        recurringId: template.id,
        amount: value,
        date: new Date(`${date}T00:00:00`),
        time,
      });
      navigateBack();
    } catch (err) {
      console.error('Failed to confirm recurring expense:', err);
      setAlertMessage('Errore durante la conferma della spesa');
    } finally {
      setIsLoading(false);
      setPendingAmount(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    const value = parseFloat(amount);
    if (!value || value <= 0) {
      showToast('Inserisci un importo valido', '⚠️');
      return;
    }

    // The amount changed: ask whether it applies to this occurrence only or to
    // all the following ones.
    if (Math.abs(value - template.amount) > 0.001) {
      setPendingAmount(value);
      return;
    }
    await doConfirm(value, false);
  };

  const handleSkip = async () => {
    if (!template) return;
    try {
      setIsLoading(true);
      await skipRecurringOccurrence(template.id);
      setAskDelete(false);
      navigateBack();
    } catch (err) {
      console.error('Failed to skip recurring occurrence:', err);
      setAlertMessage('Errore durante il salto della spesa prevista');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    if (!template) return;
    try {
      setIsLoading(true);
      await deleteRecurringExpense(template.id);
      setAskDelete(false);
      navigateBack();
    } catch (err) {
      console.error('Failed to delete recurring expense:', err);
      setAlertMessage("Errore durante l'interruzione della ricorrenza");
    } finally {
      setIsLoading(false);
    }
  };

  const titleBarActions: TitleBarAction[] = [];
  if (template) {
    titleBarActions.push({
      content: <TrashIcon />,
      label: 'Elimina',
      kind: 'danger',
      iconOnly: true,
      onClick: () => setAskDelete(true),
      disabled: isLoading,
    });
    titleBarActions.push({
      content: <CheckIcon />,
      label: 'Conferma',
      kind: 'primary',
      iconOnly: true,
      onClick: () => formRef.current?.requestSubmit(),
      disabled: isLoading,
    });
  }

  const typeName = template
    ? expenseTypes.find((t) => t.id === template.expenseTypeId)?.name ?? '?'
    : '';
  const accountName = template
    ? sortAccountsPreferred(accounts).find((a) => a.id === template.accountId)
        ?.name ?? '?'
    : '';

  return (
    <div className="entity-page">
      <TitleBar
        title={template ? `Conferma: ${template.name}` : 'Conferma spesa prevista'}
        actions={titleBarActions}
      />

      <main className="entity-content">
        {template && (
          <>
            <div className="recurring-confirm-info">
              <span>
                Ricorrenza:{' '}
                <strong>🔁 {getFrequencyLabel(template.frequency)}</strong>
              </span>
              <span>
                Categoria · Conto: <strong>{typeName} · {accountName}</strong>
              </span>
            </div>

            <form ref={formRef} className="entity-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="amount">Importo (€) *</label>
                <input
                  type="text"
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={handleAmountChange}
                  className="form-input"
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="date">Data *</label>
                <input
                  type="date"
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="time">Ora (hh:mm:ss) *</label>
                <input
                  type="time"
                  id="time"
                  step={1}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <button
                type="submit"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </form>
          </>
        )}
      </main>

      {/* Amount changed: this occurrence only, or all the following ones? */}
      <Modal
        open={pendingAmount !== null}
        title="Importo modificato"
        onClose={() => setPendingAmount(null)}
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPendingAmount(null)}
            >
              Annulla
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => pendingAmount !== null && doConfirm(pendingAmount, false)}
            >
              Solo questa
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => pendingAmount !== null && doConfirm(pendingAmount, true)}
            >
              Tutte le successive
            </button>
          </>
        }
      >
        Hai modificato l'importo della spesa prevista.
        <br />
        <br />
        Vuoi applicarlo solo a <strong>questa</strong> spesa o a{' '}
        <strong>tutte le successive</strong>?
      </Modal>

      {/* Delete: skip this period or stop the recurrence */}
      <Modal
        open={askDelete}
        title="Elimina spesa prevista"
        onClose={() => setAskDelete(false)}
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAskDelete(false)}
            >
              Annulla
            </button>
            <button type="button" className="btn-secondary" onClick={handleSkip}>
              Salta questa
            </button>
            <button type="button" className="btn-danger" onClick={handleStop}>
              Interrompi la ricorrenza
            </button>
          </>
        }
      >
        <strong>Salta questa</strong>: non viene creata nessuna spesa e la
        ricorrenza verrà proposta di nuovo nel prossimo periodo.
        <br />
        <br />
        <strong>Interrompi la ricorrenza</strong>: la spesa non verrà più
        proposta (le spese già confermate restano invariate).
      </Modal>

      <Toast message={toast?.message ?? null} icon={toast?.icon} />

      <AlertModal
        open={!!alertMessage}
        message={alertMessage}
        onClose={() => {
          setAlertMessage(null);
          navigateBack();
        }}
      />
    </div>
  );
}
