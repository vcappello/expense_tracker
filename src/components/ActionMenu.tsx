import { ReactNode, useEffect, useRef, useState } from 'react';
import { MenuIcon } from './icons';

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  trigger?: ReactNode;
  triggerLabel?: string;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Dropdown menu button identified by a three lines (hamburger) icon,
 * with optional custom trigger. Used in the title bar and in the
 * Main view action bar (Filtri / Azioni).
 */
export default function ActionMenu({
  items,
  trigger,
  triggerLabel = 'Azioni',
  align = 'right',
  className,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={`action-menu ${className || ''}`} ref={ref}>
      <button
        type="button"
        className="action-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label={triggerLabel}
        aria-expanded={open}
      >
        {trigger ?? <MenuIcon />}
      </button>
      {open && (
        <div className={`action-menu-dropdown align-${align}`}>
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              className={`action-menu-item ${item.active ? 'active' : ''}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              disabled={item.disabled}
            >
              <span className="action-menu-item-label">{item.label}</span>
              {item.active && <span className="action-menu-item-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
