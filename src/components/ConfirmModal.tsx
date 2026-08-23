import React from 'react';
import Modal from './Modal';

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
 * Critical confirmation popup used for destructive actions (two buttons:
 * Cancel "Annulla" / Confirm "Continua"). Built on the shared base Modal.
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
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      actions={
        <>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {lines}
    </Modal>
  );
}
