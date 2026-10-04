# Expense Tracker AI

A smartphone-first web app for tracking personal expenses with as little typing as possible.
The UI is in **Italian**; this document is in English.

## ⚡ Simplified expense entry (the point of the app)

Entering a movement is designed to take seconds, not a form:

1. **Best case: you only type the amount.** The app takes care of the rest.
   - **Location is derived for you**: the place field sits at the top of the expense form and
     detects your position automatically, with autocomplete search (Photon / OpenStreetMap)
     when you prefer to type. An **Online / no place** checkbox covers purchases without a
     physical location.
   - **Category is derived for you**: once a place is known (GPS or search), the app picks the
     category you usually use for that place (learned from your own history), falling back to a
     conservative place-type → category mapping (restaurants, shops, fuel, tolls). The choice is
     already selected and always editable, and a manually chosen category is never overwritten.
   - Optional **home location** (Main view → Actions) recognizes purchases made at home as online
     purchases, so you don't have to think about it.
2. **Recurring expenses: you only approve them.** Templates (expenses *and* incomes, including
   one-off ones) show up as **"Movimenti previsti"** (expected movements) when they are due — you
   just confirm, or skip/stop the series. Confirming many at once is a single tap.

Everything else (accounts, categories, routing, balance adjustments, analytics) stays available
when you need it, out of the way when you don't.

## Requirements
- Node.js 18+
- npm

## Getting started

```bash
npm install
npm run dev
```

Local URL: `http://localhost:5173/` — over the network (smartphone, same Wi-Fi): `http://192.168.1.10:5173/`

## Production / PWA
The app is an **installable PWA** (add it to the Home screen):

```bash
npm run build
npm run preview   # serves the build on http://0.0.0.0:4173/
```

Open `http://192.168.1.10:4173/` on the phone and choose *Add to Home screen* to install it.
PWA icons are regenerated with `npm run icons` (no external dependencies). After regenerating
them, **bump the icon version** (`?v=`) in `index.html`, `public/manifest.webmanifest` and
`ICON_VERSION` in `public/sw.js`: the files keep the same name, so without the bump the
cache-first service worker keeps serving the old icons even from the browser. The icon of an
installed PWA refreshes on the next launch; on iOS, if it stays stale, remove and re-add the app
to the Home screen.

## Publishing to GitHub Pages (HTTPS)
The app is published on **GitHub Pages** and usable over HTTPS:

- **URL**: `https://vcappello.github.io/expense_tracker/`
- **Deploy**: automatic on every push to `main` via GitHub Actions
  (`.github/workflows/deploy.yml`): builds with `BASE_URL=/expense_tracker/` and publishes
  `dist/` to `gh-pages`. In the repository settings → Pages, set **Source = GitHub Actions**.
- **Routing**: `HashRouter` (URLs with `#/...`) — GitHub Pages does not rewrite SPA routes, so
  hash routes always work, including on refresh, with no 404 page needed.
- **Service worker and manifest**: scope-relative paths (`self.registration.scope` in
  `public/sw.js`, relative `start_url`/`scope` in the manifest, `%BASE_URL%` in the
  `index.html` links), so the app works both from the root (local) and from a subfolder
  (GitHub Pages).
- Locally, `npm run build` + `npm run preview` keep working from the root (the default base
  path is `/`; override it with the `BASE_URL` environment variable).

### ⚠️ Data is stored in the browser
IndexedDB is bound to the **origin**: data saved on `localhost` is **not** inherited by
`https://vcappello.github.io/expense_tracker/`. Before switching to GitHub Pages, use
**Export backup** on localhost (Actions menu in the main view), then **Restore backup** on the
live site. From then on the data lives in the browser you use (the `github.io` origin is shared
across repositories of the same user).

## Main features
- **Italian UI**, optimized for smartphones
- **Installable** and **offline** (PWA: manifest, icons, service worker)
- **Expenses** and **Incomes** recorded with date and time (hh:mm:ss)
- Required **place** field near the start of expense entry: Photon search, automatic GPS
  detection on creation, an Online / no place checkbox, automatic editable category selection,
  and optional home-location recognition configured from Main view → Actions
- **Recurring and scheduled movements** (expenses and incomes, including one-off ones): shown as
  **"Movimenti previsti"** until confirmed; managed from the **Ricorrenti** page (Actions menu),
  where they can be created, edited, paused or stopped. A recurring expense without a place
  defaults to **Online / no place** on confirmation, editable for that single occurrence
- When the current month is empty, the main view states the period clearly and shows the summary
  (incomes, expenses, balance) of the latest previous month with actual movements, if available
- **Pending reimbursements**: the Actions menu lists the reimbursable expenses after the last
  salary, with the total and a shortcut to edit each one
- **Accounts** and **Categories** management (hierarchical too) with cascade deletion;
  create/edit in **dedicated pages**
- **Secondary untracked stash** account type: selectable as the main or the secondary account of
  an expense; movements assigned to a stash do not change its balance, while the full expense is
  still recorded in Analytics. The preferred account is independent and pre-selects the account
  for the matching role
- **Balance realignment** for cash and bank accounts, with dated adjustments and history; they
  update the balance and the Andamento chart without affecting incomes or expenses
- **Analytics** with a summary (total expenses/incomes, balance, average, top categories) and
  **CSV export** (Italian Excel format)
- **Charts** in Analytics: **Report**, **Grafico** (bars per day or per category/account),
  **Andamento** (continuous real balance plus a dashed projection highlighting scheduled
  expenses/incomes) and **Tendenze** (monthly expenses over the last 12 months, averages and
  rising/falling categories)
- Period filters (month, year, all) and abbreviated amounts (K/M)
- Movement rows are clickable to open the edit page; deletion is available on that page
- Data stored locally in the browser (IndexedDB)

## Project structure
- `src/App.tsx`: main routing
- `src/pages/`: pages (main view, expenses, incomes, categories, accounts, analytics)
- `src/context/AppContext.tsx`: global state and CRUD operations
- `src/db/database.ts`: IndexedDB layer
- `spec.md`: project specification
- `plan.md`: activity plan (completed steps are marked)
- `.copilot-instructions.md` / `AGENTS.md`: guidance for AI-assisted development
