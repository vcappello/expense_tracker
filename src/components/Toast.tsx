interface ToastProps {
  message: string | null;
  icon?: string;
}

/**
 * Transient message shown at the bottom of the screen. Default icon ✅
 * (success); pass a different icon (e.g. ⚠️) for warnings/validation.
 * Renders nothing when message is null.
 */
export default function Toast({ message, icon = '✅' }: ToastProps) {
  if (!message) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      {icon} {message}
    </div>
  );
}
