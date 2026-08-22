import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp, ExpenseTypeDeleteInfo } from '../context/AppContext';
import { ExpenseType } from '../types';
import TitleBar, { TitleBarAction } from '../components/TitleBar';
import { CheckIcon, TrashIcon } from '../components/icons';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/EntityForm.css';

export default function CreateExpenseTypePage() {
  const navigate = useNavigate();
  const { id: typeId } = useParams<{ id: string }>();
  const { expenseTypes, createExpenseType, updateExpenseType, getExpenseType, getExpenseTypeDeleteInfo, deleteExpenseTypeCascade } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [deleteInfo, setDeleteInfo] = useState<ExpenseTypeDeleteInfo | null>(null);

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

  const handleDelete = async () => {
    if (!typeId) return;
    try {
      const info = await getExpenseTypeDeleteInfo(typeId);
      setDeleteInfo(info);
    } catch (err) {
      console.error('Failed to load expense type delete info:', err);
      alert('Errore durante il caricamento dei dati');
    }
  };

  const confirmDelete = async () => {
    if (!typeId) return;
    try {
      await deleteExpenseTypeCascade(typeId);
      setDeleteInfo(null);
      navigate('/expense-types');
    } catch (err) {
      console.error('Failed to delete expense type:', err);
      alert('Errore durante l\'eliminazione della categoria');
    }
  };

  const closeDeleteModal = () => setDeleteInfo(null);

  const titleBarActions: TitleBarAction[] = [];
  if (typeId) {
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
    label: typeId ? 'Aggiorna' : 'Crea',
    kind: 'primary',
    iconOnly: true,
    onClick: () => formRef.current?.requestSubmit(),
    disabled: isLoading,
  });

  return (
    <div className="entity-page">
      <TitleBar
        title={typeId ? 'Modifica Categoria' : 'Crea Categoria'}
        actions={titleBarActions}
      />

      <main className="entity-content">
        <form ref={formRef} className="entity-form" onSubmit={handleSubmit}>
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

          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
        </form>
      </main>

      <ConfirmModal
        open={!!deleteInfo}
        title="Elimina Categoria"
        lines={
          deleteInfo &&
          (deleteInfo.expensesCount > 0 || deleteInfo.childCount > 0) ? (
            <>
              Questa categoria ha:
              <br />• {deleteInfo.expensesCount} {deleteInfo.expensesCount === 1 ? 'spesa' : 'spese'} per{' '}
              {Math.abs(deleteInfo.expensesTotal).toFixed(2)}€
              <br />• {deleteInfo.childCount} {deleteInfo.childCount === 1 ? 'sottocategoria' : 'sottocategorie'}
              <br />
              <br />
              Tutte le spese e le sottocategorie collegate verranno eliminate.
            </>
          ) : (
            <>Eliminare questa categoria?</>
          )
        }
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
}
