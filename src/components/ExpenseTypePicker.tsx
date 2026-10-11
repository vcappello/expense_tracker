import { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../context/AppContext';
import { ExpenseType } from '../types';
import Toast from './Toast';
import '../styles/ExpenseTypePicker.css';

interface ExpenseTypePickerProps {
  /** Id of the selected expense type ('' = none). */
  value: string;
  /** Called when a type is selected or created inline. */
  onChange: (typeId: string) => void;
  /**
   * Called on every manual input with the typed text. The expense form uses it
   * to stop a category inferred from the location from overriding a manual
   * choice.
   */
  onManualInput?: (value: string) => void;
  inputId?: string;
}

/**
 * Category search field with dropdown and inline creation of a new category,
 * shared by the expense form and the reconciliation "create" editor.
 * When `value` changes from the outside (category inferred from the location,
 * quick-fill, duplicate) the typed text is cleared and the dropdown closed.
 */
export default function ExpenseTypePicker({
  value,
  onChange,
  onManualInput,
  inputId,
}: ExpenseTypePickerProps) {
  const { expenseTypes, createExpenseType } = useApp();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setSearch('');
    setOpen(false);
  }, [value]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  const selectedType = expenseTypes.find((type) => type.id === value);
  const filteredTypes = useMemo(
    () =>
      expenseTypes.filter((type) =>
        type.name.toLowerCase().includes(search.toLowerCase())
      ),
    [expenseTypes, search]
  );

  const showToast = (message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  };

  const handleInputChange = (next: string) => {
    onManualInput?.(next);
    setSearch(next);
    setOpen(true);
  };

  const selectType = (typeId: string) => {
    onChange(typeId);
    setSearch('');
    setOpen(false);
  };

  const createType = async () => {
    const name = search.trim();
    if (!name) return;
    try {
      const newType: ExpenseType = {
        id: uuidv4(),
        name,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await createExpenseType(newType);
      selectType(newType.id);
      showToast(`Categoria "${newType.name}" creata`);
    } catch (err) {
      console.error('Failed to create expense type:', err);
    }
  };

  return (
    <div className="expense-type-container" ref={containerRef}>
      <input
        type="text"
        id={inputId}
        placeholder="Cerca o scrivi una categoria..."
        value={search || selectedType?.name || ''}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => setOpen(true)}
        className="form-input"
      />
      {open && (
        <div className="dropdown-menu">
          {filteredTypes.length > 0 && (
            <>
              {filteredTypes.map((type) => (
                <div
                  key={type.id}
                  className="dropdown-item"
                  onClick={() => selectType(type.id)}
                >
                  {type.name}
                </div>
              ))}
              <div className="dropdown-divider"></div>
            </>
          )}
          {search.trim() && !filteredTypes.find((t) => t.name === search) && (
            <div className="dropdown-item new-item" onClick={createType}>
              <span className="badge">nuovo</span> {search}
            </div>
          )}
        </div>
      )}
      <Toast message={toast} />
    </div>
  );
}
