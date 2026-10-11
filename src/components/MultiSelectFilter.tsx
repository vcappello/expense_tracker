import { ReactNode, useState, useRef, useEffect } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[]; // empty array = all
  onChange: (values: string[]) => void;
  /** Custom summary shown on the trigger (default: "Tutti" / "N selezionati"). */
  summarize?: (selected: string[]) => string;
  /** Label of the "no selection" row (default: "Tutti"). */
  allLabel?: string;
  /**
   * Quick action rendered at the top of the panel, always visible above the
   * options (e.g. a preset) and separated by a divider. Receives a callback
   * that closes the panel.
   */
  quickAction?: (close: () => void) => ReactNode;
  /** Close the panel after an option is toggled (default: keep it open). */
  closeOnSelect?: boolean;
}

/**
 * Dropdown filter with checkboxes for multiple selection.
 * An empty selection means "all".
 */
export default function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  summarize,
  allLabel = 'Tutti',
  quickAction,
  closeOnSelect = false,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const close = () => setOpen(false);

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
    if (closeOnSelect) close();
  };

  const clearAll = () => {
    onChange([]);
    if (closeOnSelect) close();
  };

  const summary = summarize
    ? summarize(selected)
    : selected.length === 0
    ? 'Tutti'
    : selected.length === 1
    ? '1 selezionato'
    : `${selected.length} selezionati`;

  return (
    <div className="multi-select" ref={containerRef}>
      <button
        type="button"
        className={`filter-select multi-select-toggle ${selected.length > 0 ? 'has-selection' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={label}
      >
        <span>{summary}</span>
        <span className="multi-select-chevron">▾</span>
      </button>

      {open && (
        <div className="multi-select-panel">
          {quickAction && (
            <div className="multi-select-quick">{quickAction(close)}</div>
          )}
          <div className="multi-select-option" onClick={clearAll}>
            <input type="checkbox" checked={selected.length === 0} readOnly />
            <span>{allLabel}</span>
          </div>
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <div
                key={option.value}
                className={`multi-select-option ${checked ? 'checked' : ''}`}
                onClick={() => toggleValue(option.value)}
              >
                <input type="checkbox" checked={checked} readOnly />
                <span>{option.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
