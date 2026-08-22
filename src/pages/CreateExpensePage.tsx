import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Expense, ExpenseType } from '../types';
import TitleBar, { TitleBarAction } from '../components/TitleBar';
import { CheckIcon, TrashIcon } from '../components/icons';
import Toast from '../components/Toast';
import '../styles/ExpenseForm.css';
import { v4 as uuidv4 } from 'uuid';

const formatTimeToHHMMSS = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export default function CreateExpensePage() {
  const navigate = useNavigate();
  const { id: expenseId } = useParams<{ id: string }>();
  const { accounts, expenseTypes, createExpense, updateExpense, createExpenseType, getExpense, deleteExpense } = useApp();

  const now = new Date();
  const [formData, setFormData] = useState({
    date: now.toISOString().split('T')[0],
    time: formatTimeToHHMMSS(now),
    amount: '',
    expenseTypeId: '',
    accountId: accounts[0]?.id || '',
  });

  const [expenseTypeSearch, setExpenseTypeSearch] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const loadExpense = async () => {
      if (expenseId) {
        try {
          const expense = await getExpense(expenseId);
          if (expense) {
            setFormData({
              date: expense.date.toISOString().split('T')[0],
              time: expense.time || formatTimeToHHMMSS(new Date()),
              amount: Math.abs(expense.amount).toString(),
              expenseTypeId: expense.expenseTypeId,
              accountId: expense.accountId,
            });
          }
        } catch (err) {
          console.error('Failed to load expense:', err);
        }
      }
    };
    
    loadExpense();
  }, [expenseId, getExpense]);

  // Update default account when accounts change
  useEffect(() => {
    if (!formData.accountId && accounts.length > 0) {
      setFormData((prev) => ({
        ...prev,
        accountId: accounts[0].id,
      }));
    }
  }, [accounts]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show a transient confirmation toast, resetting any pending timer
  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(message);
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

  const handleExpenseTypeSearch = (value: string) => {
    setExpenseTypeSearch(value);
    setShowTypeDropdown(true);
  };

  const filteredTypes = expenseTypes.filter((type) =>
    type.name.toLowerCase().includes(expenseTypeSearch.toLowerCase())
  );

  const selectExpenseType = (typeId: string) => {
    setFormData((prev) => ({
      ...prev,
      expenseTypeId: typeId,
    }));
    setExpenseTypeSearch('');
    setShowTypeDropdown(false);
  };

  const createNewExpenseType = async () => {
    if (!expenseTypeSearch.trim()) return;

    try {
      const newType: ExpenseType = {
        id: uuidv4(),
        name: expenseTypeSearch,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await createExpenseType(newType);
      selectExpenseType(newType.id);
      showToast(`Categoria "${newType.name}" creata`);
    } catch (err) {
      console.error('Failed to create expense type:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.amount || !formData.expenseTypeId || !formData.accountId) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    try {
      setIsLoading(true);

      const expense: Expense = {
        id: expenseId || uuidv4(),
        date: new Date(formData.date),
        time: formData.time,
        amount: parseFloat(formData.amount),
        expenseTypeId: formData.expenseTypeId,
        accountId: formData.accountId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (expenseId) {
        await updateExpense(expense);
      } else {
        await createExpense(expense);
      }

      navigate('/');
    } catch (err) {
      console.error('Failed to save expense:', err);
      alert('Errore durante il salvataggio della spesa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!expenseId) return;
    if (!window.confirm('Vuoi eliminare questa spesa?')) return;
    try {
      await deleteExpense(expenseId);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete expense:', err);
      alert('Errore durante l\'eliminazione della spesa');
    }
  };

  const titleBarActions: TitleBarAction[] = [];
  if (expenseId) {
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
    label: expenseId ? 'Aggiorna' : 'Crea',
    kind: 'primary',
    iconOnly: true,
    onClick: () => formRef.current?.requestSubmit(),
    disabled: isLoading,
  });

  const selectedType = expenseTypes.find((t) => t.id === formData.expenseTypeId);

  return (
    <div className="expense-page">
      <TitleBar
        title={expenseId ? 'Modifica spesa' : 'Nuova spesa'}
        actions={titleBarActions}
      />

      <main className="page-content">
        <form ref={formRef} className="expense-form" onSubmit={handleSubmit}>
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

          {/* Expense Type Field */}
          <div className="form-group">
            <label htmlFor="expenseType">Categoria *</label>
            <div className="expense-type-container" ref={dropdownRef}>
              <input
                type="text"
                id="expenseType"
                placeholder="Cerca o scrivi una categoria..."
                value={expenseTypeSearch || selectedType?.name || ''}
                onChange={(e) => handleExpenseTypeSearch(e.target.value)}
                onFocus={() => setShowTypeDropdown(true)}
                className="form-input"
              />

              {showTypeDropdown && (
                <div className="dropdown-menu">
                  {filteredTypes.length > 0 && (
                    <>
                      {filteredTypes.map((type) => (
                        <div
                          key={type.id}
                          className="dropdown-item"
                          onClick={() => selectExpenseType(type.id)}
                        >
                          {type.name}
                        </div>
                      ))}
                      <div className="dropdown-divider"></div>
                    </>
                  )}

                  {expenseTypeSearch.trim() && !filteredTypes.find((t) => t.name === expenseTypeSearch) && (
                    <div className="dropdown-item new-item" onClick={createNewExpenseType}>
                      <span className="badge">nuovo</span> {expenseTypeSearch}
                    </div>
                  )}
                </div>
              )}
            </div>
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
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Hidden submit button to keep native form submission (e.g. Enter key) */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
        </form>
      </main>

      <Toast message={toast} />
    </div>
  );
}
