// HashRouter: su GitHub Pages le route SPA non vengono riscritte dal server,
// quindi gli URL con hash (#/...) funzionano sempre (anche al refresh) senza
// dover configurare un file 404. Il comportamento del Back (navigate(-1),
// window.history.state.idx) resta identico al BrowserRouter.
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { initializeDefaultData } from './utils/initialization';
import MainView from './pages/MainView';
import CreateExpensePage from './pages/CreateExpensePage';
import CreateCashflowPage from './pages/CreateCashflowPage';
import ExpenseTypeManagementPage from './pages/ExpenseTypeManagementPage';
import CreateExpenseTypePage from './pages/CreateExpenseTypePage';
import AccountManagementPage from './pages/AccountManagementPage';
import CreateAccountPage from './pages/CreateAccountPage';
import AnalyticsPage from './pages/AnalyticsPage';
import './styles.css';

function AppContent() {
  const { isLoading, error } = useApp();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeDefaultData();
        setInitialized(true);
      } catch (err) {
        console.error('Failed to initialize app:', err);
      }
    };

    init();
  }, []);

  if (!initialized) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Caricamento...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<MainView />} />
          <Route path="/expense/new" element={<CreateExpensePage />} />
          <Route path="/expense/:id/edit" element={<CreateExpensePage />} />
          <Route path="/cashflow/new" element={<CreateCashflowPage />} />
          <Route path="/cashflow/:id/edit" element={<CreateCashflowPage />} />
          <Route path="/expense-types" element={<ExpenseTypeManagementPage />} />
          <Route path="/expense-type/new" element={<CreateExpenseTypePage />} />
          <Route path="/expense-type/:id/edit" element={<CreateExpenseTypePage />} />
          <Route path="/accounts" element={<AccountManagementPage />} />
          <Route path="/account/new" element={<CreateAccountPage />} />
          <Route path="/account/:id/edit" element={<CreateAccountPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
