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
- **⚠️ GIT + DEPLOY SEMPRE ATTIVI (cruciale)**: il progetto è su **GitHub** (remote `origin` = https://github.com/vcappello/expense_tracker.git, branch `main`) ed è **pubblicato su GitHub Pages** (https://vcappello.github.io/expense_tracker/, HTTPS, deploy automatico via `.github/workflows/deploy.yml` a ogni push su `main`; nome repo = `expense_tracker` con underscore, NON `expense-tracker-ai`). Dopo OGNI modifica rilevante: verificare `npm run build`, poi `git add -A && git commit -m "..." && git push` → il sito live si aggiorna da solo. Mai trattare il progetto come solo-locale.

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
- **Backup/Ripristino DB (Export/Import JSON)**: IndexedDB è legato all'origine → al cambio di origine (es. passaggio a HTTPS) i dati non vengono ereditati. L'app offre "Esporta backup" / "Ripristina backup" nel menu Azioni della Main view: export = file JSON (`expense-tracker-backup-YYYY-MM-DD.json`) con tutti gli store (date ISO; **versione file attuale = 2**, include `recurringExpenses`); import = sostituzione **atomica** (clear + insert nella stessa transazione, `db.importAllData` in `src/db/database.ts`) con `ConfirmModal` di avviso (conteggi) e reload dello stato via `restoreBackup` (AppContext); file non validi → `AlertModal`. Logica in `src/utils/backup.ts` (`exportDatabase`, `readBackupFile` con normalizzazione `initialBalance`/`isPreferred`/`parentId`/`routingAccountId` e riconversione ISO → Date). **I file v1 (senza `recurringExpenses`) restano accettati**: il campo mancante diventa una lista vuota. NON separare clear e insert (non atomico). L'import valido sovrascrive tutto: testare su un'origine di prova, mai su quella con i dati reali.
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
- **Note/Luogo su Expense (`notes`, `location`)**: campi stringa facoltativi su `Expense`
  (default `''`, normalizzati in lettura in `normalizeExpense` di `database.ts` e in import
  in `backup.ts`; niente bump `DB_VERSION`). Non influenzano Analytics/saldi. Passare
  `notes`/`location` nel form spesa e nell'input di `saveExpenseWithCoins` (oggetto
  `Expense` in `AppContext`).
- **Luogo da GPS (reverse geocoding)**: il bottone 📍 accanto al campo Luogo usa
  `navigator.geolocation.getCurrentPosition` + **Nominatim** online
  (`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=..&lon=..&zoom=18&accept-language=it`).
  È l'**unica chiamata di rete** dell'app e avviene solo alla pressione del bottone.
  Geolocation richiede **secure context** (HTTPS o localhost; NON su HTTP su IP di rete).
  Gestire errore/permesso negato/timeout/offline con `Toast` ⚠️ e lasciare il campo
  manuale: non bloccare MAI il salvataggio (luogo facoltativo). Errore GPS: codice 1 =
  permesso negato, 2 = posizione non disponibile, 3 = timeout.
- **Main view — lista per giorno (righe senza data/ora)**: la lista è raggruppata per giorno
  in TUTTI i filtri; le righe mostrano **solo i dettagli** (mai data/ora; l'ora conta solo
  per l'ordinamento): Spesa = "💸 Categoria · Conto" (+ 📍 Luogo su seconda riga se
  `location` compilata), Entrata = conto, routing = sorgente → destinazione. Header giorno:
  compatto nei filtri a mese singolo ("4 ven", oggi con "· Oggi"), con mese per esteso in
  Quest'anno/Tutti ("Settembre 5 Sab", anno aggiunto per giorni fuori dall'anno corrente).
  Helper in `src/utils/formatting.ts` (`isSameDay`/`isToday`/`formatDayHeader`). La
  paginazione lavora su **gruppi giorno interi** (mai tagliare un giorno: se il confine di
  pagina cade a metà giorno, il giorno intero passa alla pagina successiva) con auto-load
  dei gruppi quando il contenuto non riempie il viewport (altrimenti niente scroll per
  caricare). NON ripristinare data/ora sulle righe.
- **`moduleResolution` nei tsconfig**: usare **`"Bundler"`** (in `tsconfig.app.json` e
  `tsconfig.node.json`), NON `"Node"` (modalità legacy "node10" → warning TS
  "moduleResolution=node10 is deprecated ... TypeScript 7.0"). Fix già applicato il
  05/09/2026.
- **Analytics/Categorie/Conti caricano i movimenti da soli**: `AnalyticsPage`,
  `ExpenseTypeManagementPage` e `AccountManagementPage` chiamano
  `loadMovements({ dateRange: 'all' })` nel loro mount (dataset completo, poi ogni pagina
  applica il proprio filtro). I `movements` del context NON sono quindi più scoped al
  filtro della Main view: non rimuovere quelle chiamate, altrimenti con reload diretto su
  `#/analytics` i totali sono vuoti e i filtri periodo di Analytics/Categorie calcolano su
  dati incompleti. In Gestione Conti "ultimo movimento" ordina per data+ora (`toDateTime`).
- **Main view — importo sempre visibile (luogo lungo)**: la riga movimento è una **griglia
  a 2 colonne** `grid-template-columns: minmax(0, 1fr) auto` (`.movement-content` in
  `src/styles/MainView.css`): la colonna sinistra (dettagli) si comprime sempre e il testo
  va a capo in altezza — il luogo `.movement-place` è limitato a **max 2 righe con
  ellissi** (`line-clamp`/`-webkit-line-clamp` + `overflow-wrap: anywhere`); la colonna
  destra è l'**importo** (`.amount`: `white-space: nowrap`, `min-width`, font
  ingrandito/bold) e resta sempre visibile. La riga usa `align-items: baseline` così
  l'importo è allineato alla **prima riga** di testo (non centrato sul blocco); padding
  verticale generoso (14px / 12px mobile) = **area di tocco ampia** per il tap. **⚠️
  Collisione classi CSS globali**: i CSS delle pagine sono caricati tutti insieme (import
  statici in `App.tsx`) → NON riusare gli stessi nomi di classe tra pagine diverse. Le
  classi del report Analytics ora hanno il prefisso `report-*` (`report-movements-list`,
  `report-movement-type`): `movements-list`/`movement-type` sono SOLO della Main view (che
  dichiara `display: block` su `.movements-list` per difesa). Prima questo conflitto
  (il `display: grid` di `AnalyticsPage.css`) allargava la lista per giorno fino a
  spingere l'importo fuori schermo su smartphone.
- **Spese da rimborsare / stipendio (`reimbursable`, `isSalary`)**: `Expense.reimbursable`
  (checkbox "Sarà rimborsata" nel form spesa, anche sul record principale delle spese con
  monete) e `Cashflow.isSalary` (checkbox "Stipendio" nel form entrata), default false,
  normalizzati in lettura in `database.ts` e in import in `backup.ts` (niente bump
  `DB_VERSION`). Nel form entrata, con "Stipendio" attivo, il pannello mostra il totale
  delle spese rimborsabili **dopo l'ultimo stipendio precedente** (approccio "solo finestra
  di tempo", niente stato 'rimborsata'): helper in `src/utils/reimbursements.ts`
  (`findPreviousSalary`, `getReimbursableSummary`) + metodo `getReimbursableSummary` nel
  context. Le spese rimborsabili restano spese normali in Analytics/saldi; in **Main view
  le righe con `reimbursable` mostrano un badge "da rimborsare"** (pill accanto alla
  descrizione, decisione 06/09/2026: tutte le marcate, indipendenti dagli stipendi). Quando
  si aggiunge un flag booleano a un record ricordarsi di
  aggiornare: types, normalizzazione lettura (database.ts), normalizzazione import
  (backup.ts) e TUTTI gli object literal che costruiscono il record (coins.ts,
  AppContext, form).
- **Spese ricorrenti (`RecurringExpense`, store `recurringExpenses`)**: **primo bump del
  progetto `DB_VERSION` 1 → 2** (`database.ts`): in `onupgradeneeded` creare SOLO gli store
  mancanti (i dati esistenti non vanno toccati) e gestire `request.onblocked` con un errore
  chiaro (un'altra tab con la versione vecchia blocca l'upgrade). La **prevista NON è un
  record**: è derivata dal template con `src/utils/recurrence.ts`
  (`getExpectedOccurrence(s)`), usando i campi di stato sul template
  `lastConfirmedPeriod` / `lastConfirmedExpenseId` / `skippedPeriod` (chiave periodo:
  `2026-09-12` giornaliera, `2026-W37` settimanale ISO lun–dom, `2026-09` mensile, `2026`
  annuale). Regole: **una sola prevista per periodo** (le mancate si saltano), la prevista
  compare dalla **data di scadenza** del periodo corrente e resta finché non è confermata o
  il periodo finisce; mensile 31 → ultimo giorno del mese, annuale 29/02 → 28/02; template
  `active: false` o periodo in `skippedPeriod`/`lastConfirmedPeriod` → nessuna prevista. La
  **conferma** crea un `Expense` normale con `recurringId` + `recurringPeriod` (link
  idempotente) e aggiorna lo stato del template; "Conferma tutte" usa
  `confirmRecurringOccurrences` (in blocco, undo unico). **Eliminare un Expense confermato
  ripropone la prevista** (in `deleteExpense` lo stato del template viene azzerato se
  corrisponde al periodo): non rimuovere quel blocco. Il template eliminato **scollega**
  (`recurringId=null`) le spese già create. Cascade: `deleteAccountCascade` /
  `deleteExpenseTypeCascade` devono chiamare `deleteRecurringExpensesByAccount/ByType` e i
  popup mostrano "N spese ricorrenti" (`countRecurringByIndex`). La conferma modifica
  importo/data/ora → modale a **3 pulsanti** ("Solo questa" / "Tutte le successive");
  Elimina → "Salta questa" / "Interrompi la ricorrenza"; il `Toast` ha ora una **azione
  opzionale** (`actionLabel`/`onAction`) usata per l'undo (5s invece di 2.5s). Analytics: le
  previste contano nei totali sotto la pseudo-categoria `EXPECTED_EXPENSE_TYPE_ID`
  (`__expected__`, "Spese previste", colore grigio `#94a3b8` forzato in
  `MovementsChart`/`MonthBreakdownChart`), con data = **scadenza**, filtro Conto applicato e
  filtro Categoria non applicato; **mai** nei saldi conto. Le pagine che le mostrano devono
  chiamare `loadRecurringExpenses()` nel mount (Main view, Analytics, pagina Ricorrenze).

## Limiti noti (non bloccanti)
- **Main view al primo load freddo**: a volte il filtro "This month" appare vuoto subito dopo il caricamento della pagina (comportamento transitorio legato a IndexedDB); cliccando un qualsiasi filtro i dati compaiono. Rivedere il timing di lettura se si ripresenta. (Non riproducibile in modo stabile il 12/09/2026: 5 reload consecutivi con dati corretti.)

## Note di database (da `spec.md`)
- Tabelle: `Expense`, `Cashflow`, `ExpenseType`, `Account` (DB locale); dallo 12/09/2026 anche `RecurringExpense` (store `recurringExpenses`, `DB_VERSION` 2).
- Valori iniziali Account: Cash, Bank account.
- Valori iniziali ExpenseType: Dinner, Shopping, Fuel, Tolls.
- Importi *abbreviate*: in K oltre 999, in M oltre 999.999, con 2 decimali.
