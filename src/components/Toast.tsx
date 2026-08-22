interface ToastProps {
  message: string | null;
}

/**
 * Transient confirmation message shown at the bottom of the screen.
 * Renders nothing when message is null.
 */
export default function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      ✅ {message}
    </div>
  );
}
