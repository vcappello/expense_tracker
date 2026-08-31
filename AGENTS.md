# AGENTS.md — Note per agenti AI di sviluppo

> Questo file viene letto automaticamente dagli agenti di coding all'inizio di ogni sessione.
> Contiene contesto utile, convenzioni e **problemi già risolti** per evitare di ripeterli.
> Da aggiornare ogni volta che si incontra e risolve un problema o si impara qualcosa di nuovo.

## Progetto
- **Expense Tracker AI**: webapp per monitoraggio spese personali, ottimizzata per smartphone.
- **Stack**: React 18 + TypeScript + Vite 5. Nessuna dipendenza esterna non necessaria.
- **Hardware**: Raspberry Pi (ARM).
- **Specifiche**: vedi `spec.md` (da aggiornare con ogni nuova feature).
- **Piano attività**: vedi `plan.md` (step completati = marcati, mai cancellati).
- **Convenzioni complete**: vedi `.copilot-instructions.md` (file di riferimento principale).

## Comandi
- Avvio dev server: `npm run dev` (serve **terminale unsandboxed** per ascoltare su rete).
- Build: `npm run build` (verificare sempre prima di concludere feature importanti).
- URL locale: `http://localhost:5173/` — URL rete: `http://192.168.1.10:5173/`

## Convenzioni di sviluppo
- UI/etichette in **italiano**, codice e nomi di variabili/componenti in **inglese**.
- Glossario UI italiano: Spesa (Expense), Entrata (Cashflow), Conto (Account), Categoria (ExpenseType), Analisi (Analytics), Saldo (Net), Riepilogo (Summary), Modifica (Edit), Elimina (Delete), Annulla (Cancel), Crea/Crea nuovo (Create), Indietro (Back).
- I dati seed (nomi default di Account e ExpenseType) restano **in inglese come da spec.md** (Cash, Bank account, Dinner, Shopping, Fuel, Tolls); non sono etichette UI.
- Codice chiaro e tipizzato; componenti semplici e file piccoli; niente codice inutilizzato o duplicato.
- Logica di business separata dalla UI.
- Documentare le modifiche rilevanti nel README.

## Problemi risolti (evitare di re-incontrare)
- **Il server Vite non parte / porta occupata**: verificare con `ss -tlnp | grep 5173` e `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`.
- **Il banner di Vite non appare nell'output del terminale** quando avviato in modalità async, ma il server può comunque essere attivo: verificare sempre con curl/ss prima di riavviare.
- **`npm run dev` deve girare in terminale unsandboxed** altrimenti non può ascoltare sulle interfacce di rete (necessario per il test da smartphone).
- **Seed dati default**: `initializeDefaultData` usa una promise condivisa a livello di modulo per essere idempotente e concurrency-safe (evita `ConstraintError` con React StrictMode/doppio mount in dev). NON ripristinare il pattern con chiamate concorrenti.
- **Delete in cascata**: per eliminare Account/ExpenseType con i movimenti collegati usare `deleteAccountCascade` / `deleteExpenseTypeCascade` dal context (non chiamare i singoli delete manualmente). Info per il popup di conferma via `getAccountDeleteInfo` / `getExpenseTypeDeleteInfo`. Popup critico = componente `ConfirmModal`.
- **Edit Cashflow**: il form pre-carica i dati via `getCashflow`; per i cashflow con routing aggiorna il movimento positivo in place e ricrea la controparte negativa.
- **Warning Fast Refresh su `AppContext.tsx`** ("useApp export is incompatible"): è preesistente e innocuo (mix di export di componenti e non-componenti dallo stesso file). Non bloccante.
- **Total Cashflow Analytics** deve escludere i cashflow di routing: il movimento ricevente (`routingAccountId` valorizzato) E la sua controparte negativa (rilevata come cashflow negativo con stessa data+ora+importo assoluto di un routing). Il `Net` usa `totalCashflows - totalExpenses` (gli importi spesa sono memorizzati positivi).
- **Totale ExpenseType** deve includere le spese dei figli nella gerarchia (usare la raccolta ricorsiva dei descendant ids).
- **Export CSV** (`src/utils/csv.ts`): usare `;` come delimitatore, `,` come decimale e BOM UTF-8 (convenzione Excel italiana); le spese escono con segno negativo (memorizzate positive). Il pulsante è in Analytics e rispetta i filtri attivi.
- **Backup/Ripristino DB (Export/Import JSON)**: IndexedDB è legato all'origine → al cambio di origine (es. passaggio a HTTPS) i dati non vengono ereditati. L'app offre "Esporta backup" / "Ripristina backup" nel menu Azioni della Main view: export = file JSON (`expense-tracker-backup-YYYY-MM-DD.json`) con tutti gli store (date ISO); import = sostituzione **atomica** (clear + insert nella stessa transazione, `db.importAllData` in `src/db/database.ts`) con `ConfirmModal` di avviso (conteggi) e reload dello stato via `restoreBackup` (AppContext); file non validi → `AlertModal`. Logica in `src/utils/backup.ts` (`exportDatabase`, `readBackupFile` con normalizzazione `initialBalance`/`isPreferred`/`parentId`/`routingAccountId` e riconversione ISO → Date). NON separare clear e insert (non atomico). L'import valido sovrascrive tutto: testare su un'origine di prova, mai su quella con i dati reali.
- **Create/Edit in nuova view**: Account ed ExpenseType usano pagine dedicate (`CreateAccountPage.tsx`, `CreateExpenseTypePage.tsx`, stile condiviso `EntityForm.css`) con route in `App.tsx` (`/account/new|:id/edit`, `/expense-type/new|:id/edit`). Le pagine di gestione navigano a queste route invece di usare form inline. Non reintrodurre `form-panel` inline in quelle pagine.
- **Average Daily Expense** = totale spese / giorni del periodo (`getDateRange`). Conteggio giorni con `Math.floor((end-start)/gg)+1` (NON `Math.round`, altrimenti off-by-one perché l'end è a 23:59:59.999).
- **Race condition all'avvio**: `AppContext` deve attendere `initializeDefaultData()` (promise condivisa, idempotente) prima di leggere account/categorie, altrimenti su DB vuoto i dropdown restano senza conti. NON rimuovere quell'attesa.
- **Filtri Analytics**: la selezione multipla usa il componente `MultiSelectFilter` (checkbox; array vuoto = tutti). Il filtro categoria espande i discendenti nella gerarchia. Periodi disponibili in `getDateRange`: current/previous-month, current/previous-year, last-5-years, all.
- **Grafico Analytics**: view con **switch Report/Grafico** (pulsanti in `AnalyticsPage`). Il grafico = `MovementsChart` (SVG divergente, senza librerie): entrate verde sopra la linea, spese rosso sotto, totali giornalieri, esclusi i routing (helper `isRoutingCashflow` condiviso con i totali). Aggregazione giornaliera in `chartData` (key YYYY-MM-DD).
- **Grafico per categoria**: le spese nel grafico sono **barre impilate per categoria** (`expensesByType` in `chartData`); colori dalla palette `PALETTE` in `MovementsChart`, ordinati per nome categoria; legenda colori + tooltip con categoria e importo.
- **Gotcha SVG**: in SVG le regole **CSS vincono sull'attributo `fill`**. Per colori per-elemento usare **`style={{ fill: ... }}`** inline (che vince sempre), altrimenti una regola CSS come `.chart-bar.expense { fill: #ef4444 }` sovrascrive l'attributo e tutte le barre escono dello stesso colore. Il colore va applicato in un solo punto.
- **Grafico mese vs giornaliero**: per le viste a mese singolo (`current-month`/`previous-month`) si usa `MonthBreakdownChart` (barre separate una per conto/categoria); per gli altri periodi `MovementsChart` (giornaliero, spese impilate per categoria). La scelta è in `AnalyticsPage` tramite `isMonthView` + `monthBreakdown`.
- **Main view routing**: un cashflow con routing crea 2 movimenti nel DB ma in lista ne viene mostrato **uno solo** (il ricevente, giallo); la controparte negativa è nascosta. Logica condivisa in `src/utils/routing.ts` (`isRoutingCashflow`, `routingCounterpartIds`) usata da `AppContext.loadMovements` (filtro) e `AnalyticsPage` (esclusione dai totali).
- **Toast**: componente `Toast` (messaggio in basso, si auto-nasconde) con stile globale in `styles.css`; usato per confermare la creazione inline della categoria nel form spesa (`showToast` con timer).
- **Importi abbreviati**: in Analytics (sommario, top categorie, report movimenti) e nelle pagine di gestione (totali categoria, ultimo movimento account) usare `abbreviateAmount` (K >999, M >999.999, 2 decimali). Nella Main view gli importi sono già abbreviati. I totali del popup di conferma delete in `ConfirmModal` restano volutamente precisi (`.toFixed(2)`).
- **PWA (nessuna dipendenza esterna)**: manifest in `public/manifest.webmanifest`; icone generate da `scripts/generate-icons.mjs` con `npm run icons` (encoder PNG puro con zlib, disegna un quadrato verde arrotondato con il glifo € su griglia 13x13); service worker `public/sw.js` (navigate network-first + fallback `/index.html`, asset `/assets/`+`/icons/`+manifest cache-first); registrato **solo in produzione** (`import.meta.env.PROD` in `main.tsx`) per evitare cache in dev. Build di produzione: `npm run build` + `npm run preview` (host 0.0.0.0, porta 4173).
- **Redesign UI (fase 1)**: `Header.tsx`/`Header.css` eliminati e sostituiti da `TitleBar` + `ActionMenu` (componenti condivisi) con icone SVG in `src/components/icons.tsx`. Regole: pulsante creazione sempre nella title bar a destra (Main view, Categorie, Conti); view di modifica → title bar con **Conferma (✓)** ed **Elimina (🗑)**, niente Annulla (il Back annulla e torna indietro); view di creazione → **solo Conferma (✓)**; menu azioni a tre righe per azioni extra (Main view: Analisi/Conti/Categorie; Analytics: Esporta CSV). I form non hanno più pulsanti in fondo: la Conferma in title bar invia con `formRef.current?.requestSubmit()` (in ogni form c'è un bottone submit nascosto `.sr-only` per l'invio con Invio). In MainView le righe movimento sono cliccabili (niente pulsanti edit/delete a destra; la delete è spostata nella view di modifica; le righe mostrano il dettaglio: categoria per Spesa, conto per Entrata, sorgente→destinazione per routing).
- **Back button**: usa `navigate(-1)` (default della `TitleBar`) per tornare alla view di origine preservando lo stack. NON usare `onBack` che fanno `navigate('/...')` nelle view di create/edit: pushano una nuova entry e rompono lo stack (es. main→conti→edit: al secondo Back si tornava a edit invece che a main). Verificare sempre con il percorso main→lista→edit→Back→Back.
- **Liste gestione (Conti/Categorie)**: come la Main view, le righe sono cliccabili e aprono la view di modifica (niente pulsanti edit/delete; nelle Categorie il chevron espande/collassa con `stopPropagation`). La delete è solo nella view di modifica (per conti/categorie usa `ConfirmModal` + delete in cascata). Pluralizzazione italiana nei popup: spesa/spese, entrata/entrate, sottocategoria/sottocategorie (non usare il suffisso `'e'` su "spesa"/"entrata").
- **Giacenza iniziale conto (`initialBalance`)**: campo sul modello `Account` (NON un movimento) → non compare in Analytics/Main view (restano puliti, niente skew al primo mese). Il **saldo** mostrato in Gestione Conti = `initialBalance + cashflows − expenses` (cashflows include anche le controparti negative dei routing, quindi i saldi per conto sono corretti). In lettura (`db.getAccounts`/`getAccount`) normalizzare `initialBalance` a 0 per i record esistenti senza campo. In `CreateAccountPage` il campo "Giacenza iniziale (€)" è opzionale (default 0); usare `setFormData((prev) => ...)` per preservare gli altri campi.
- **Conto preferito (`isPreferred`)**: flag booleano su `Account` (default false, normalizzato in lettura). I conti preferiti vengono mostrati **per primi** nei dropdown di inserimento Spese/Entrate e nella lista Conti (con ★); il primo preferito è il conto default nei form spesa/entrata (nel seed è Bank account). Ordinamento centralizzato in `src/utils/accounts.ts` (`sortAccountsPreferred`) — usarlo sempre quando si elencano i conti (mai `accounts.map` diretto nei dropdown).
- **Conto monete (`isCoinAccount`)**: flag booleano su `Account` (default false, normalizzato in lettura in `database.ts` e in import in `backup.ts`). I conti con il flag sono gli **unici** proposti nel dropdown "Conto monete" del form spesa (feature coin split); in Gestione Conti mostrano il badge 🪙. Nel form spesa, se una selezione esistente non è più tra i conti flaggati (flag rimosso), il dropdown la mantiene come opzione di ripiego.
- **Navigazione dopo save/delete (Back button)**: i form create/edit dopo salvataggio/eliminazione usavano `navigate('/...')` (es. `navigate('/accounts')`, `navigate('/expense-types')`, `navigate('/')`) che **pushano una nuova entry** e rompono lo stack del Back (es. main → conti → crea conto → salva → al secondo Back si tornava alla form invece che a main). Usare sempre `useNavigateBack(fallback)` da `src/utils/navigation.ts`: fa `navigate(-1)` se esiste una entry precedente (`window.history.state.idx > 0`), altrimenti usa il fallback (route canonica) per i casi di reload/accesso diretto. NON reintrodurre `navigate('/...')` diretti nei form.
- **Modali: mai native, solo componenti condivisi**: non usare `window.confirm`/`window.alert`/`window.prompt` né `alert()`. Tutte le modali sono componenti React custom: base **`Modal`** (`src/components/Modal.tsx` + `src/styles/Modal.css`, close su backdrop/ESC, `aria-modal`) + wrapper **`ConfirmModal`** (2 bottoni Annulla/Continua) + **`AlertModal`** (1 bottone OK per gli errori). I messaggi transitori/validazioni usano **`Toast`** (prop `icon` per il prefisso, default ✅, usare ⚠️ per i warning). `ConfirmModal.css` non esiste più: gli stili sono in `Modal.css`.
- **Link `routingPairId` (routing e spese con monete)**: campo opzionale su `Expense` e `Cashflow` (null = record normale; non serve bump `DB_VERSION`, normalizzato in lettura in `database.ts` e in import in `backup.ts`). Entrambi i leg di un routing condividono lo stesso `routingPairId`; `src/utils/routing.ts` usa il **link esplicito** per `isRoutingCashflow`/`routingCounterpartIds` con **fallback euristico** (data+ora+importo) per i record legacy senza link. Regola detection: cashflow con `routingPairId` AND (`routingAccountId` set OR `amount < 0`) = leg routing; cashflow **positivo** con `routingPairId` senza `routingAccountId` = **entrata interna di coin split** (da nascondere nelle liste, ma conteggiata in Analytics — opzione A). In `CreateCashflowPage` il routing: create → 2 leg con lo stesso pair id; edit → preserva il pair id e **rimuove la vecchia controparte negativa** (fix orfani: prima restavano negativi fantasma cambiando data/ora/importo); delete → rimuove il counterpart via link (fallback euristico se legacy). Per cercare i cashflow del gruppo usare `getCashflows` (dal context) filtrando per `routingPairId`.

- **`movements` del context = TUTTI i movimenti del periodo**: `loadMovements` NON nasconde
  i cashflow interni (controparti negative dei routing ed entrate interne di coin split).
  Il nascondimento è un filtro di **visualizzazione** per-view: `MainView` e la lista
  report/CSV di `AnalyticsPage` usano `routingCounterpartIds`; i **totali** di Analytics
  usano `isRoutingCashflow` (l'entrata interna di coin split CONTA in Total Cashflow —
  opzione A — e i leg di routing restano esclusi). NON reintrodurre l'hiding in
  `loadMovements`: romperebbe i totali Analytics.
- **GitHub Pages (HTTPS)**: l'app gira in una **sottocartella**
  (`https://vcappello.github.io/expense_tracker/`). Regole da non violare:
  `vite.config.ts` legge `process.env.BASE_URL` (default `/`; il workflow CI builda con
  `BASE_URL=/expense_tracker/`); routing con **`HashRouter`** (URL `#/...` — GitHub Pages
  non riscrive le route SPA, niente 404.html; `navigate(-1)` e `window.history.state.idx`
  funzionano identici). Non reintrodurre `BrowserRouter` né percorsi assoluti: in
  `public/sw.js` usare `self.registration.scope` (mai `/assets/`, `/index.html` hardcoded),
  nel manifest `start_url`/`scope`/icone relativi, in `index.html` il placeholder
  `%BASE_URL%` per manifest/icone, registrazione SW con `import.meta.env.BASE_URL`.
  Build locale alla root resta valida (base default `/`). I dati IndexedDB sono legati
  all'origine: da localhost non si ereditano → Esporta/Ripristina backup.

## Limiti noti (non bloccanti)
- **Main view al primo load freddo**: a volte il filtro "This month" appare vuoto subito dopo il caricamento della pagina (comportamento transitorio legato a IndexedDB); cliccando un qualsiasi filtro i dati compaiono. Rivedere il timing di lettura se si ripresenta.
- **Pagine Analytics/Categories/Accounts**: non caricano i `movements` da sole; dipendono da quelli caricati dalla Main view. Con navigazione diretta (bookmark/reload su `/analytics`) i totali risultano vuoti. Da considerare un `loadMovements` nel mount di queste pagine.

## Note di database (da `spec.md`)
- Tabelle: `Expense`, `Cashflow`, `ExpenseType`, `Account` (DB locale).
- Valori iniziali Account: Cash, Bank account.
- Valori iniziali ExpenseType: Dinner, Shopping, Fuel, Tolls.
- Importi *abbreviate*: in K oltre 999, in M oltre 999.999, con 2 decimali.
