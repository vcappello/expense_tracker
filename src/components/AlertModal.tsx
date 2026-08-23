import React from 'react';
import Modal from './Modal';

interface AlertModalProps {
  open: boolean;
  title?: string;
  message?: React.ReactNode;
  okLabel?: string;
  onClose: () => void;
}

/**
 * Informational popup with a single OK button, used for operation errors
 * (save / load / delete failed).
 */
export default function AlertModal({
  open,
  title = 'Errore',
  message,
  okLabel = 'OK',
  onClose,
}: AlertModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      actions={
        <button type="button" className="btn-primary" onClick={onClose}>
          {okLabel}
        </button>
      }
    >
      {message}
    </Modal>
  );
}
