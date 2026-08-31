import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path dell'app. Default '/' per sviluppo locale e preview.
// Su GitHub Pages l'app gira in una sottocartella del repo
// (es. https://vcappello.github.io/expense_tracker/): il workflow CI
// (.github/workflows/deploy.yml) builda con BASE_URL=/expense_tracker/,
// così asset, manifest e SW puntano alla sottocartella corretta.
const base = process.env.BASE_URL || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0'
  },
  preview: {
    port: 4173,
    host: '0.0.0.0'
  }
});
