import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Cashflow } from '../types';
import Header from '../components/Header';
import '../styles/CashflowForm.css';
import { v4 as uuidv4 } from 'uuid';

const formatTimeToHHMMSS = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export default function CreateCashflowPage() {
  const navigate = useNavigate();
  const { id: cashflowId } = useParams<{ id: string }>();
  const { accounts, createCashflow, updateCashflow, getCashflow } = useApp();

  const now = new Date();
  const [formData, setFormData] = useState({
    date: now.toISOString().split('T')[0],
    time: formatTimeToHHMMSS(now),
    amount: '',
    accountId: '',
    routingAccountId: '',
  });

  const [isLoading, setIsLoading] = useState(false);

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
        accountId: accounts[0].id,
      }));
    }
  }, [accounts, formData.accountId]);

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
      alert('Compila tutti i campi obbligatori');
      return;
    }

    try {
      setIsLoading(true);

      if (formData.routingAccountId) {
        // Create 2 cashflows: one for routing account (negative), one for main account (positive)
        const cashflow1: Cashflow = {
          id: uuidv4(),
          date: new Date(formData.date),
          time: formData.time,
          amount: -parseFloat(formData.amount),
          accountId: formData.routingAccountId,
          routingAccountId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        if (cashflowId) {
          // Editing a routing cashflow: update the positive movement in place,
          // then recreate the negative routing movement
          const cashflow2: Cashflow = {
            id: cashflowId,
            date: new Date(formData.date),
            time: formData.time,
            amount: parseFloat(formData.amount),
            accountId: formData.accountId,
            routingAccountId: formData.routingAccountId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await updateCashflow(cashflow2);
          await createCashflow(cashflow1);
        } else {
          const cashflow2: Cashflow = {
            id: uuidv4(),
            date: new Date(formData.date),
            time: formData.time,
            amount: parseFloat(formData.amount),
            accountId: formData.accountId,
            routingAccountId: formData.routingAccountId,
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
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        if (cashflowId) {
          await updateCashflow(cashflow);
        } else {
          await createCashflow(cashflow);
        }
      }

      navigate('/');
    } catch (err) {
      console.error('Failed to save cashflow:', err);
      alert('Errore durante il salvataggio dell\'entrata');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className="cashflow-page">
      <Header title={cashflowId ? 'Modifica entrata' : 'Nuova entrata'} showBack={true} />

      <main className="page-content">
        <form className="cashflow-form" onSubmit={handleSubmit}>
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
              {accounts.map((account) => (
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
              {accounts.map((account) => (
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

          {/* Action Buttons */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Salvataggio...' : cashflowId ? 'Aggiorna' : 'Crea'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
