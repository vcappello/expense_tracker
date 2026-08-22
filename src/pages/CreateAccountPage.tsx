import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Account } from '../types';
import Header from '../components/Header';
import '../styles/EntityForm.css';

export default function CreateAccountPage() {
  const navigate = useNavigate();
  const { id: accountId } = useParams<{ id: string }>();
  const { createAccount, updateAccount, getAccount } = useApp();

  const [formData, setFormData] = useState({
    name: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Pre-populate form when editing an existing account
  useEffect(() => {
    const loadAccount = async () => {
      if (!accountId) return;
      try {
        const account = await getAccount(accountId);
        if (account) {
          setFormData({ name: account.name });
        }
      } catch (err) {
        console.error('Failed to load account:', err);
      }
    };

    loadAccount();
  }, [accountId, getAccount]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ name: e.target.value });
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

      if (accountId) {
        const existing = await getAccount(accountId);
        if (existing) {
          await updateAccount({
            ...existing,
            name: formData.name,
            updatedAt: now,
          });
        }
      } else {
        const newAccount: Account = {
          id: Date.now().toString(),
          name: formData.name,
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

  const handleCancel = () => {
    navigate('/accounts');
  };

  return (
    <div className="entity-page">
      <Header title={accountId ? 'Modifica Conto' : 'Crea Conto'} showBack={true} />

      <main className="entity-content">
        <form className="entity-form" onSubmit={handleSubmit}>
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

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Annulla
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Salvataggio...' : accountId ? 'Aggiorna' : 'Crea'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
