# Expense Tracker AI

Web app per monitorare le spese personali in modo semplice e immediato.

## Requisiti
- Node.js 18+
- npm

## Avvio

```bash
npm install
npm run dev
```

URL locale: `http://localhost:5173/` — dalla rete (smartphone, stessa WiFi): `http://192.168.1.10:5173/`

## Produzione / PWA
L'app è una **PWA installabile** (aggiungi a schermata Home):

```bash
npm run build
npm run preview   # serve la build su http://0.0.0.0:4173/
```

Dal telefono apri `http://192.168.1.10:4173/` e scegli *Aggiungi a schermata Home* per installarla.
Le icone PWA si rigenerano con `npm run icons` (nessuna dipendenza esterna).

## Pubblicazione su GitHub Pages (HTTPS)
L'app è pubblicata su **GitHub Pages** e usabile via HTTPS:

- **URL**: `https://vcappello.github.io/expense_tracker/`
- **Deploy**: automatico a ogni push su `main` tramite GitHub Actions
  (`.github/workflows/deploy.yml`): build con `BASE_URL=/expense_tracker/` e
  pubblicazione di `dist/` su `gh-pages`. In Impostazioni del repo → Pages impostare
  **Source = GitHub Actions**.
- **Routing**: `HashRouter` (URL con `#/...`) — GitHub Pages non riscrive le route SPA,
  quindi con gli hash le view funzionano sempre, anche al refresh, senza file 404.
- **Service worker e manifest**: percorsi relativi allo scope
  (`self.registration.scope` in `public/sw.js`, `start_url`/`scope` relativi nel manifest,
  `%BASE_URL%` nei link di `index.html`), così l'app funziona sia da root (locale) sia da
  sottocartella (GitHub Pages).
- In locale: `npm run build` + `npm run preview` continuano a funzionare alla root
  (il base path default è `/`; si personalizza con la variabile d'ambiente `BASE_URL`).

### ⚠️ Dati salvati nel browser
IndexedDB è legato all'**origine**: i dati salvati su `localhost` **non** vengono ereditati
dal dominio `https://vcappello.github.io/expense_tracker/`. Prima di passare a GitHub
Pages, su localhost fai **Esporta backup** (menu Azioni della Main view), poi sul sito
online fai **Ripristina backup**. Da quel momento i dati restano nel browser usato
(l'origine `github.io` è condivisa tra i repo dello stesso utente).

## Funzioni principali
- Interfaccia in **italiano** ottimizzata per smartphone
- **Installabile** e **offline** (PWA: manifest, icone, service worker)
- Registrazione di **Spese** ed **Entrate** con data e ora (hh:mm:ss)
- Gestione **Conti** e **Categorie** (anche gerarchiche) con eliminazione in cascata; creazione/modifica in **pagine dedicate**
- **Analisi** con riepilogo (totale spese/entrate, saldo, media, top categorie) e **esportazione CSV** (formato Excel italiano)
- Filtri per periodo (mese, anno, tutto), importi abbreviati (K/M)
- Movimenti con pulsanti modifica/elimina sempre visibili
- Dati salvati localmente nel browser (IndexedDB)

## Struttura
- `src/App.tsx`: routing principale
- `src/pages/`: pagine (main view, spese, entrate, categorie, conti, analisi)
- `src/context/AppContext.tsx`: stato globale e operazioni CRUD
- `src/db/database.ts`: layer IndexedDB
- `spec.md`: specifiche di progetto
- `plan.md`: piano attività (step completati = marcati)
- `.copilot-instructions.md` / `AGENTS.md`: indicazioni per lo sviluppo assistito da agent AI
