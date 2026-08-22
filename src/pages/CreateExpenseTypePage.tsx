import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ExpenseType } from '../types';
import Header from '../components/Header';
import '../styles/EntityForm.css';

export default function CreateExpenseTypePage() {
  const navigate = useNavigate();
  const { id: typeId } = useParams<{ id: string }>();
  const { expenseTypes, createExpenseType, updateExpenseType, getExpenseType } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Pre-populate form when editing an existing expense type
  useEffect(() => {
    const loadType = async () => {
      if (!typeId) return;
      try {
        const type = await getExpenseType(typeId);
        if (type) {
          setFormData({ name: type.name, parentId: type.parentId || '' });
        }
      } catch (err) {
        console.error('Failed to load expense type:', err);
      }
    };

    loadType();
  }, [typeId, getExpenseType]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
  };

  const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, parentId: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Inserisci il nome della categoria');
      return;
    }

    try {
      setIsLoading(true);
      const now = new Date();

      if (typeId) {
        const existing = await getExpenseType(typeId);
        if (existing) {
          await updateExpenseType({
            ...existing,
            name: formData.name,
            parentId: formData.parentId || null,
            updatedAt: now,
          });
        }
      } else {
        const newType: ExpenseType = {
          id: Date.now().toString(),
          name: formData.name,
          parentId: formData.parentId || null,
          createdAt: now,
          updatedAt: now,
        };
        await createExpenseType(newType);
      }

      navigate('/expense-types');
    } catch (err) {
      console.error('Failed to save expense type:', err);
      alert('Errore durante il salvataggio della categoria');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/expense-types');
  };

  return (
    <div className="entity-page">
      <Header title={typeId ? 'Modifica Categoria' : 'Crea Categoria'} showBack={true} />

      <main className="entity-content">
        <form className="entity-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Nome Categoria *</label>
            <input
              type="text"
              id="name"
              placeholder="es. Spesa, Carburante, Caffè"
              value={formData.name}
              onChange={handleNameChange}
              className="form-input"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="parent">Categoria padre (opzionale)</label>
            <select
              id="parent"
              value={formData.parentId}
              onChange={handleParentChange}
              className="form-input"
            >
              <option value="">Nessuno</option>
              {expenseTypes
                .filter((t) => !typeId || t.id !== typeId)
                .map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
            </select>
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
              {isLoading ? 'Salvataggio...' : typeId ? 'Aggiorna' : 'Crea'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
