import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionMenu, { ActionMenuItem } from './ActionMenu';
import { BackIcon } from './icons';
import '../styles/TitleBar.css';

export interface TitleBarAction {
  content: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  kind?: 'primary' | 'danger' | 'ghost' | 'toggle';
  iconOnly?: boolean;
}

interface TitleBarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: TitleBarAction[];
  menu?: ActionMenuItem[];
}

/**
 * Shared title bar: view title on the left (with Back button), actions on the
 * right (create / confirm / delete buttons and the three lines action menu).
 * The Back button cancels any pending changes and returns to the previous view.
 */
export default function TitleBar({
  title,
  showBack = true,
  onBack,
  actions = [],
  menu = [],
}: TitleBarProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header className="title-bar">
      <div className="title-bar-left">
        {showBack && (
          <button
            type="button"
            className="title-bar-back"
            onClick={handleBack}
            aria-label="Indietro"
          >
            <BackIcon />
          </button>
        )}
        <h1 className="title-bar-title">{title}</h1>
      </div>
      <div className="title-bar-right">
        {actions.map((action, idx) => (
          <button
            key={idx}
            type="button"
            className={`title-bar-action ${action.kind || 'ghost'} ${
              action.active ? 'active' : ''
            } ${action.iconOnly ? 'icon' : ''}`}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.label}
            aria-label={action.iconOnly ? action.label : undefined}
          >
            {action.content}
          </button>
        ))}
        {menu.length > 0 && <ActionMenu items={menu} />}
      </div>
    </header>
  );
}
