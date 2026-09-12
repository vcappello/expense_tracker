interface ToastProps {
  message: string | null;
  icon?: string;
  // Optional action button (e.g. "Annulla" to undo the action that raised the toast)
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Transient message shown at the bottom of the screen. Default icon ✅
 * (success); pass a different icon (e.g. ⚠️) for warnings/validation.
 * Renders nothing when message is null.
 */
export default function Toast({ message, icon = '✅', actionLabel, onAction }: ToastProps) {
  if (!message) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>
        {icon} {message}
      </span>
      {actionLabel && onAction && (
        <button type="button" className="toast-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
