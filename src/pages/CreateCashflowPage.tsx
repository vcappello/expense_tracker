import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Cashflow } from '../types';
import { sortAccountsPreferred } from '../utils/accounts';
import { useNavigateBack } from '../utils/navigation';
import TitleBar, { TitleBarAction } from '../components/TitleBar';
import { CheckIcon, TrashIcon } from '../components/icons';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import '../styles/CashflowForm.css';
import { v4 as uuidv4 } from 'uuid';

const formatTimeToHHMMSS = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export default function CreateCashflowPage() {
  const navigateBack = useNavigateBack('/');
  const { id: cashflowId } = useParams<{ id: string }>();
  const { accounts, createCashflow, updateCashflow, getCashflow, getCashflows, deleteCashflow } = useApp();
  const sortedAccounts = sortAccountsPreferred(accounts);

  const now = new Date();
  const [formData, setFormData] = useState({
    date: now.toISOString().split('T')[0],
    time: formatTimeToHHMMSS(now),
    amount: '',
    accountId: '',
    routingAccountId: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [toast, setToast] = useState<{ message: string; icon?: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pre-populate form when editing an existing cashflow
  useEffect(() => {
    const loadCashflow = async () => {
      if (!cashflowId) return;
      try {
        const cashflow = await getCashflow(cashflowId);
        if (cashflow) {
          setFormData({
            date: cashflow.date.toISOString().split('T')[0],
            time: cashflow.time || formatTimeToHHMMSS(new Date()),
            amount: Math.abs(cashflow.amount).toString(),
            accountId: cashflow.accountId,
            routingAccountId: cashflow.routingAccountId || '',
          });
        }
      } catch (err) {
        console.error('Failed to load cashflow:', err);
      }
    };

    loadCashflow();
  }, [cashflowId, getCashflow]);

  // Update default account when accounts change
  useEffect(() => {
    if (!formData.accountId && accounts.length > 0) {
      setFormData((prev) => ({
        ...prev,
        accountId: sortedAccounts[0].id,
      }));
    }
  }, [accounts, formData.accountId]);

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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      date: e.target.value,
    }));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      time: e.target.value,
    }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({
        ...prev,
        amount: value,
      }));
    }
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      accountId: e.target.value,
    }));
  };

  const handleRoutingAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      routingAccountId: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.amount || !formData.accountId) {
      showToast('Compila tutti i campi obbligatori', '⚠️');
      return;
    }

    try {
      setIsLoading(true);

      if (formData.routingAccountId) {
        if (cashflowId) {
          // Editing a routing cashflow: update the positive movement in place,
          // remove the previous negative counterpart(s) of the pair, then
          // recreate the negative movement with the same routingPairId link.
          const current = await getCashflow(cashflowId);
          const pairId = current?.routingPairId ?? uuidv4();
          const all = await getCashflows();
          const previousLegs = all.filter(
            (c) => c.routingPairId === pairId && c.id !== cashflowId
          );
          for (const leg of previousLegs) {
            await deleteCashflow(leg.id);
          }

          const cashflow1: Cashflow = {
            id: uuidv4(),
            date: new Date(formData.date),
            time: formData.time,
            amount: -parseFloat(formData.amount),
            accountId: formData.routingAccountId,
            routingAccountId: null,
            routingPairId: pairId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const cashflow2: Cashflow = {
            id: cashflowId,
            date: new Date(formData.date),
            time: formData.time,
            amount: parseFloat(formData.amount),
            accountId: formData.accountId,
            routingAccountId: formData.routingAccountId,
            routingPairId: pairId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await updateCashflow(cashflow2);
          await createCashflow(cashflow1);
        } else {
          // Create 2 cashflows: one for routing account (negative), one for
          // main account (positive). Both legs share the same routingPairId so
          // the pair is detected exactly (no date/time/amount heuristic).
          const pairId = uuidv4();
          const cashflow1: Cashflow = {
            id: uuidv4(),
            date: new Date(formData.date),
            time: formData.time,
            amount: -parseFloat(formData.amount),
            accountId: formData.routingAccountId,
            routingAccountId: null,
            routingPairId: pairId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const cashflow2: Cashflow = {
            id: uuidv4(),
            date: new Date(formData.date),
            time: formData.time,
            amount: parseFloat(formData.amount),
            accountId: formData.accountId,
            routingAccountId: formData.routingAccountId,
            routingPairId: pairId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await createCashflow(cashflow1);
          await createCashflow(cashflow2);
        }
      } else {
        // Create single cashflow
        const cashflow: Cashflow = {
          id: cashflowId || uuidv4(),
          date: new Date(formData.date),
          time: formData.time,
          amount: parseFloat(formData.amount),
          accountId: formData.accountId,
          routingAccountId: null,
          routingPairId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        if (cashflowId) {
          await updateCashflow(cashflow);
        } else {
          await createCashflow(cashflow);
        }
      }

      navigateBack();
    } catch (err) {
      console.error('Failed to save cashflow:', err);
      setAlertMessage('Errore durante il salvataggio dell\'entrata');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!cashflowId) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!cashflowId) return;
    try {
      const current = await getCashflow(cashflowId);
      if (current?.routingAccountId) {
        // Delete also the negative counterpart of the routing transfer. Prefer
        // the explicit pair link; fall back to the date/time/amount heuristic
        // for legacy records without a link.
        const all = await getCashflows();
        let counterpart = current.routingPairId
          ? all.find(
              (c) =>
                c.routingPairId === current.routingPairId && c.id !== current.id
            )
          : undefined;
        if (!counterpart) {
          const key = `${new Date(current.date).getTime()}|${current.time || ''}|${Math.abs(current.amount)}`;
          counterpart = all.find(
            (c) =>
              c.id !== current.id &&
              !c.routingAccountId &&
              c.amount < 0 &&
              `${new Date(c.date).getTime()}|${c.time || ''}|${Math.abs(c.amount)}` === key
          );
        }
        if (counterpart) await deleteCashflow(counterpart.id);
      }
      await deleteCashflow(cashflowId);
      navigateBack();
    } catch (err) {
      console.error('Failed to delete cashflow:', err);
      setAlertMessage('Errore durante l\'eliminazione dell\'entrata');
    }
  };

  const titleBarActions: TitleBarAction[] = [];
  if (cashflowId) {
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
    label: cashflowId ? 'Aggiorna' : 'Crea',
    kind: 'primary',
    iconOnly: true,
    onClick: () => formRef.current?.requestSubmit(),
    disabled: isLoading,
  });

  return (
    <div className="cashflow-page">
      <TitleBar
        title={cashflowId ? 'Modifica entrata' : 'Nuova entrata'}
        actions={titleBarActions}
      />

      <main className="page-content">
        <form ref={formRef} className="cashflow-form" onSubmit={handleSubmit}>
          {/* Date Field */}
          <div className="form-group">
            <label htmlFor="date">Data *</label>
            <input
              type="date"
              id="date"
              value={formData.date}
              onChange={handleDateChange}
              required
              className="form-input"
            />
          </div>

          {/* Time Field */}
          <div className="form-group">
            <label htmlFor="time">Ora (hh:mm:ss) *</label>
            <input
              type="time"
              id="time"
              step={1}
              value={formData.time}
              onChange={handleTimeChange}
              required
              className="form-input"
            />
          </div>

          {/* Amount Field */}
          <div className="form-group">
            <label htmlFor="amount">Importo (€) *</label>
            <input
              type="text"
              inputMode="decimal"
              id="amount"
              placeholder="0.00"
              value={formData.amount}
              onChange={handleAmountChange}
              required
              className="form-input"
            />
          </div>

          {/* Account Field */}
          <div className="form-group">
            <label htmlFor="account">Conto *</label>
            <select
              id="account"
              value={formData.accountId}
              onChange={handleAccountChange}
              required
              className="form-input"
            >
              <option value="">Seleziona conto</option>
              {sortedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Routing Account Field (Optional) */}
          <div className="form-group">
            <label htmlFor="routingAccount">Conto di routing (opzionale)</label>
            <select
              id="routingAccount"
              value={formData.routingAccountId}
              onChange={handleRoutingAccountChange}
              className="form-input"
            >
              <option value="">Nessuno</option>
              {sortedAccounts.map((account) => (
                <option
                  key={account.id}
                  value={account.id}
                  disabled={account.id === formData.accountId}
                >
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-info">
            {formData.routingAccountId && (
              <p className="info-text">
                💡 Verranno creati 2 movimenti:
                <br />
                • -{formData.amount || '0.00'}€ da {accounts.find((a) => a.id === formData.routingAccountId)?.name}
                <br />
                • +{formData.amount || '0.00'}€ a {accounts.find((a) => a.id === formData.accountId)?.name}
              </p>
            )}
          </div>

          {/* Hidden submit button to keep native form submission (e.g. Enter key) */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
        </form>
      </main>

      <Toast message={toast?.message ?? null} icon={toast?.icon} />

      <ConfirmModal
        open={showDeleteConfirm}
        title="Elimina Entrata"
        lines="Vuoi eliminare questa entrata?"
        confirmLabel="Elimina"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <AlertModal
        open={!!alertMessage}
        message={alertMessage}
        onClose={() => setAlertMessage(null)}
      />
    </div>
  );
}
