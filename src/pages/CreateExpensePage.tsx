import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ExpenseType } from '../types';
import { sortAccountsPreferred } from '../utils/accounts';
import { useNavigateBack } from '../utils/navigation';
import TitleBar, { TitleBarAction } from '../components/TitleBar';
import { CheckIcon, TrashIcon } from '../components/icons';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import '../styles/ExpenseForm.css';
import { v4 as uuidv4 } from 'uuid';

const formatTimeToHHMMSS = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export default function CreateExpensePage() {
  const navigateBack = useNavigateBack('/');
  const { id: expenseId } = useParams<{ id: string }>();
  const { accounts, expenseTypes, createExpenseType, getExpense, deleteExpense, saveExpenseWithCoins, getCashflows } = useApp();
  const sortedAccounts = sortAccountsPreferred(accounts);
  const coinAccounts = sortedAccounts.filter((a) => a.isCoinAccount);

  const now = new Date();
  const [formData, setFormData] = useState({
    date: now.toISOString().split('T')[0],
    time: formatTimeToHHMMSS(now),
    amount: '',
    expenseTypeId: '',
    accountId: sortedAccounts[0]?.id || '',
    coinsAccountId: '',
    coinsAmount: '',
  });

  const [expenseTypeSearch, setExpenseTypeSearch] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [toast, setToast] = useState<{ message: string; icon?: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const loadExpense = async () => {
      if (expenseId) {
        try {
          const expense = await getExpense(expenseId);
          if (expense) {
            // Pre-fill the coin-split fields (if any) from the linked group:
            // the internal income is the positive Cashflow with the same
            // routingPairId and no routingAccountId.
            let coinsAccountId = '';
            let coinsAmount = '';
            if (expense.routingPairId) {
              const all = await getCashflows();
              const income = all.find(
                (c) =>
                  c.routingPairId === expense.routingPairId &&
                  c.routingAccountId === null &&
                  c.amount > 0
              );
              if (income) {
                coinsAccountId = income.accountId;
                coinsAmount = Math.abs(income.amount).toString();
              }
            }
            setFormData({
              date: expense.date.toISOString().split('T')[0],
              time: expense.time || formatTimeToHHMMSS(new Date()),
              amount: Math.abs(expense.amount).toString(),
              expenseTypeId: expense.expenseTypeId,
              accountId: expense.accountId,
              coinsAccountId,
              coinsAmount,
            });
          }
        } catch (err) {
          console.error('Failed to load expense:', err);
        }
      }
    };
    
    loadExpense();
  }, [expenseId, getExpense, getCashflows]);

  // Update default account when accounts change
  useEffect(() => {
    if (!formData.accountId && accounts.length > 0) {
      setFormData((prev) => ({
        ...prev,
        accountId: sortedAccounts[0].id,
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
    const accountId = e.target.value;
    setFormData((prev) => ({
      ...prev,
      accountId,
      // if the main account becomes the coins account, clear it
      coinsAccountId:
        prev.coinsAccountId === accountId ? '' : prev.coinsAccountId,
    }));
  };

  const handleCoinsAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({
        ...prev,
        coinsAmount: value,
      }));
    }
  };

  const handleCoinsAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      coinsAccountId: e.target.value,
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
      showToast('Compila tutti i campi obbligatori', '⚠️');
      return;
    }

    const total = parseFloat(formData.amount);
    const coinsAmount = formData.coinsAmount
      ? parseFloat(formData.coinsAmount)
      : 0;
    const coinsAccountSelected = formData.coinsAccountId !== '';
    const hasCoins = coinsAccountSelected && coinsAmount > 0;

    if (coinsAmount > 0 && !coinsAccountSelected) {
      showToast('Seleziona il conto delle monete', '⚠️');
      return;
    }
    if (coinsAccountSelected && coinsAmount <= 0) {
      showToast('Inserisci l\'importo in monete', '⚠️');
      return;
    }
    if (hasCoins && coinsAmount > total) {
      showToast('L\'importo in monete non può superare l\'importo totale', '⚠️');
      return;
    }

    try {
      setIsLoading(true);

      await saveExpenseWithCoins({
        expenseId: expenseId || undefined,
        date: new Date(formData.date),
        time: formData.time,
        amount: total,
        expenseTypeId: formData.expenseTypeId,
        accountId: formData.accountId,
        coinsAccountId: hasCoins ? formData.coinsAccountId : null,
        coinsAmount: hasCoins ? coinsAmount : null,
      });

      navigateBack();
    } catch (err) {
      console.error('Failed to save expense:', err);
      setAlertMessage('Errore durante il salvataggio della spesa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!expenseId) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!expenseId) return;
    try {
      await deleteExpense(expenseId);
      navigateBack();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      setAlertMessage('Errore durante l\'eliminazione della spesa');
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

  const coinsActive =
    formData.coinsAccountId !== '' && parseFloat(formData.coinsAmount) > 0;
  const mainAccountName =
    accounts.find((a) => a.id === formData.accountId)?.name || '?';
  const coinsAccountName =
    accounts.find((a) => a.id === formData.coinsAccountId)?.name || '?';

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
              inputMode="decimal"
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
              {sortedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Coin split (optional): paid partly from a second account */}
          <div className="form-section">
            <div className="form-section-title">
              Pagato in parte con monete (opzionale)
            </div>
            <div className="form-group">
              <label htmlFor="coinsAmount">Importo in monete (€)</label>
              <input
                type="text"
                inputMode="decimal"
                id="coinsAmount"
                placeholder="0.00"
                value={formData.coinsAmount}
                onChange={handleCoinsAmountChange}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="coinsAccount">Conto monete</label>
              <select
                id="coinsAccount"
                value={formData.coinsAccountId}
                onChange={handleCoinsAccountChange}
                className="form-input"
              >
                <option value="">Nessuno</option>
                {coinAccounts.map((account) => (
                  <option
                    key={account.id}
                    value={account.id}
                    disabled={account.id === formData.accountId}
                  >
                    {account.name}
                  </option>
                ))}
                {/* keep a legacy selection even if the coin flag was removed */}
                {formData.coinsAccountId &&
                  !coinAccounts.some((a) => a.id === formData.coinsAccountId) && (
                    <option value={formData.coinsAccountId}>
                      {accounts.find((a) => a.id === formData.coinsAccountId)?.name ||
                        '?'}
                    </option>
                  )}
              </select>
              {coinAccounts.length === 0 && (
                <p className="field-hint">
                  Nessun conto monete: crealo dalla gestione Conti.
                </p>
              )}
            </div>
            {coinsActive && (
              <div className="form-info">
                <p className="info-text">
                  💡 Verranno creati 3 movimenti:
                  <br />• Spesa −{formData.amount || '0.00'}€ su{' '}
                  {mainAccountName}
                  <br />• Entrata +{formData.coinsAmount || '0.00'}€ su{' '}
                  {coinsAccountName}
                  <br />• 🔄 {coinsAccountName} → {mainAccountName}
                </p>
              </div>
            )}
          </div>

          {/* Hidden submit button to keep native form submission (e.g. Enter key) */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
        </form>
      </main>

      <Toast message={toast?.message ?? null} icon={toast?.icon} />

      <ConfirmModal
        open={showDeleteConfirm}
        title="Elimina Spesa"
        lines="Vuoi eliminare questa spesa?"
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
