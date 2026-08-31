import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: registra il service worker solo in produzione (in dev evita cache e
// comportamenti inattesi durante lo sviluppo).
// Il path usa import.meta.env.BASE_URL per funzionare sia da root (dev/preview)
// sia da sottocartella (GitHub Pages: /expense_tracker/sw.js). Lo scope
// risultante è quindi la directory dell'app in entrambi i casi.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        /* il SW è opzionale: l'app funziona anche senza */
      });
  });
}
