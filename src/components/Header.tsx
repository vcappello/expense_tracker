import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';

interface HeaderProps {
  title: string;
  onNewExpense?: () => void;
  onNewCashflow?: () => void;
  showBack?: boolean;
}

export default function Header({
  title,
  onNewExpense,
  onNewCashflow,
  showBack = true,
}: HeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          {showBack && window.location.pathname !== '/' && (
            <button className="btn-back" onClick={handleBack}>
              ← Indietro
            </button>
          )}
          <h1>{title}</h1>
        </div>

        <div className="header-actions">
          {onNewExpense && (
            <button className="btn-primary" onClick={onNewExpense}>
              + Spesa
            </button>
          )}
          {onNewCashflow && (
            <button className="btn-primary" onClick={onNewCashflow}>
              + Entrata
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
