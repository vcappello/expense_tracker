import React from 'react';
import '../styles/ConfirmModal.css';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  lines?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Critical confirmation popup used for destructive actions
 * (e.g. deleting an Account or ExpenseType with linked movements).
 */
export default function ConfirmModal({
  open,
  title,
  lines,
  confirmLabel = 'Continua',
  cancelLabel = 'Annulla',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        {lines && <div className="modal-content">{lines}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
