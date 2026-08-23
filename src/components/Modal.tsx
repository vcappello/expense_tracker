import { ReactNode, useEffect } from 'react';
import '../styles/Modal.css';

interface ModalProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
}

/**
 * Shared base modal: overlay + title + content + actions area.
 * Closes on backdrop click and on ESC. Used as the base for ConfirmModal and
 * AlertModal, so that overlay/CSS/accessibility are not duplicated.
 */
export default function Modal({ open, title, children, actions, onClose }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-title">{title}</h3>
        {children != null && <div className="modal-content">{children}</div>}
        {actions != null && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
