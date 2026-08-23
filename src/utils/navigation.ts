import { useNavigate } from 'react-router-dom';

/**
 * Returns a handler that returns to the previous view in the navigation
 * history, preserving the back stack (see spec "Back button navigation" rule).
 *
 * Used after save/delete from create/edit pages: instead of pushing a new
 * route (which would pollute the back stack and break the Back button — e.g.
 * main → accounts → create → save → back → back should return to main, not to
 * the create form again), it goes back one step with `navigate(-1)`.
 *
 * Falls back to `fallback` (the canonical list route) when there is no
 * previous entry in the history (e.g. the page was reloaded or opened directly
 * at the create/edit URL), otherwise `navigate(-1)` would be a no-op or leave
 * the app.
 */
export function useNavigateBack(fallback: string): () => void {
  const navigate = useNavigate();
  return () => {
    if ((window.history.state?.idx ?? 0) > 0) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };
}
