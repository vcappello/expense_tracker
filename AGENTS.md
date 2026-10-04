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
- **⚠️ GIT + DEPLOY SEMPRE ATTIVI (cruciale)**: il progetto è su **GitHub** (remote `origin` = https://github.com/vcappello/expense_tracker.git, branch `main`) ed è **pubblicato su GitHub Pages** (https://vcappello.github.io/expense_tracker/, HTTPS, deploy automatico via `.github/workflows/deploy.yml` a ogni push su `main`; nome repo = `expense_tracker` con underscore, NON `expense-tracker-ai`). Mai trattare il progetto come solo-locale.
- **✋ REGOLA PUSH — CHIEDERE SEMPRE CONFERMA (dal 19/09/2026)**: **fermarsi prima del `git push` e chiedere esplicitamente il via libera all'utente.** Motivo: il push fa partire GitHub Actions che pubblica subito la nuova versione sul sito live, e l'utente vuole prima poterla provare sul server di sviluppo. Flusso corretto:
  1. `npm run build` (verifica);
  2. `git add -A && git commit -m "..."` → **commit locale, si può fare senza chiedere** (resta reversibile);
  3. **CHIEDERE CONFERMA** all'utente (mostrando cosa è stato committato e cosa manca da pushare);
  4. solo dopo il suo OK: `git push origin main`, poi verificare il deploy (`curl -s https://api.github.com/repos/vcappello/expense_tracker/actions/runs` per lo stato del workflow e `curl -s -o /dev/null -w "%{http_code}" https://vcappello.github.io/expense_tracker/` per il sito live).
  Non fare MAI il push in autonomia, nemmeno a fine sessione o su modifiche "banali" (docs inclusi).

## Comandi
- Avvio dev server: `npm run dev` (serve **terminale unsandboxed** per ascoltare su rete).
- Build: `npm run build` (verificare sempre prima di concludere feature importanti).
- URL locale: `http://localhost:5173/` — URL rete: `http://192.168.1.10:5173/`

## Convenzioni di sviluppo
- UI/etichette in **italiano**, codice e nomi di variabili/componenti in **inglese**.
- Glossario UI italiano: Spesa (Expense), Entrata (Cashflow), Conto (Account), Categoria (ExpenseType), Analisi (Analytics), Saldo (Net), Riepilogo (Summary), Modifica (Edit), Elimina (Delete), Annulla (Cancel), Crea/Crea nuovo (Create), Indietro (Back).
- I dati seed (nomi default di Account e ExpenseType) restano **in inglese come da spec.md** (Cash, Bank account, Coins, Dinner, Shopping, Fuel, Tolls); non sono etichette UI.
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
- **Backup/Ripristino DB (Export/Import JSON)**: IndexedDB è legato all'origine → al cambio di origine (es. passaggio a HTTPS) i dati non vengono ereditati. "Esporta backup" / "Ripristina backup" nel menu Azioni della Main view usa un file JSON con tutti gli store (date ISO; **versione file attuale = 3**, include `recurringExpenses` e `accountBalanceAdjustments`); import = sostituzione **atomica** (clear + insert nella stessa transazione, `db.importAllData` in `src/db/database.ts`) con `ConfirmModal` di avviso (conteggi) e reload dello stato via `restoreBackup` (AppContext); file non validi → `AlertModal`. **I file v1/v2 restano accettati**: i campi nuovi mancanti diventano liste vuote. NON separare clear e insert (non atomico). L'import valido sovrascrive tutto: testare su un'origine di prova, mai su quella con i dati reali.
- **Create/Edit in nuova view**: Account ed ExpenseType usano pagine dedicate (`CreateAccountPage.tsx`, `CreateExpenseTypePage.tsx`, stile condiviso `EntityForm.css`) con route in `App.tsx` (`/account/new|:id/edit`, `/expense-type/new|:id/edit`). Le pagine di gestione navigano a queste route invece di usare form inline. Non reintrodurre `form-panel` inline in quelle pagine.
- **Average Daily Expense** = totale spese / giorni del periodo (`getDateRange`). Conteggio giorni con `Math.floor((end-start)/gg)+1` (NON `Math.round`, altrimenti off-by-one perché l'end è a 23:59:59.999).
- **Race condition all'avvio**: `AppContext` deve attendere `initializeDefaultData()` (promise condivisa, idempotente) prima di leggere account/categorie, altrimenti su DB vuoto i dropdown restano senza conti. NON rimuovere quell'attesa.
- **Filtri Analytics**: la selezione multipla usa il componente `MultiSelectFilter` (checkbox; array vuoto = tutti). Il filtro categoria espande i discendenti nella gerarchia. Periodi disponibili in `getDateRange`: current/previous-month, current/previous-year, last-5-years, all.
- **Grafico Analytics**: view con **switch Report/Grafico** (pulsanti in `AnalyticsPage`). Il grafico = `MovementsChart` (SVG divergente, senza librerie): entrate verde sopra la linea, spese rosso sotto, totali giornalieri, esclusi i routing (helper `isRoutingCashflow` condiviso con i totali). Aggregazione giornaliera in `chartData` (key YYYY-MM-DD).
- **Grafico per categoria**: le spese nel grafico sono **barre impilate per categoria** (`expensesByType` in `chartData`); colori dalla palette `PALETTE` in `MovementsChart`, ordinati per nome categoria; legenda colori + tooltip con categoria e importo.
- **Gotcha SVG**: in SVG le regole **CSS vincono sull'attributo `fill`**. Per colori per-elemento usare **`style={{ fill: ... }}`** inline (che vince sempre), altrimenti una regola CSS come `.chart-bar.expense { fill: #ef4444 }` sovrascrive l'attributo e tutte le barre escono dello stesso colore. Il colore va applicato in un solo punto.
- **Grafico mese vs giornaliero**: per le viste a mese singolo (`current-month`/`previous-month`) si usa `MonthBreakdownChart` (barre separate una per conto/categoria); per gli altri periodi `MovementsChart` (giornaliero, spese impilate per categoria). La scelta è in `AnalyticsPage` tramite `isMonthView` + `monthBreakdown`.
- **Main view routing**: un cashflow con routing crea 2 movimenti nel DB ma in lista ne viene mostrato **uno solo** (il ricevente, giallo); la controparte negativa è nascosta. Logica condivisa in `src/utils/routing.ts` (`isRoutingCashflow`, `routingCounterpartIds`) usata da `AppContext.loadMovements` (filtro) e `AnalyticsPage` (esclusione dai totali).
- **Empty state mese corrente**: se il filtro è "Mese corrente", non c'è ricerca attiva e
  non ci sono movimenti/occorrenze visibili, la Main view mantiene esplicito che il mese
  corrente è vuoto e può mostrare il riepilogo dell'ultimo mese storico con movimenti. Il
  calcolo è separato dalla lista filtrata, esclude routing e previste, include l'entrata
  interna del conto secondario non tracciato come Analytics; gli errori di lettura non vanno confusi con
  l'assenza di storico.
- **Toast**: componente `Toast` (messaggio in basso, si auto-nasconde) con stile globale in `styles.css`; usato per confermare la creazione inline della categoria nel form spesa (`showToast` con timer).
- **Importi abbreviati**: in Analytics (sommario, top categorie, report movimenti) e nelle pagine di gestione (totali categoria, ultimo movimento account) usare `abbreviateAmount` (K >999, M >999.999, 2 decimali). Nella Main view gli importi sono già abbreviati. I totali del popup di conferma delete in `ConfirmModal` restano volutamente precisi (`.toFixed(2)`).
- **Form Spesa: "solo l'importo" (autofocus + dettagli collassati)**: in creazione il campo
  **Importo** prende il focus da solo (`autoFocus={!expenseId}`, così su Android appare subito
  il tastierino `inputMode="decimal"`) e i campi opzionali (Data, Ora, "Sarà rimborsata", Note,
  conto secondario) stanno in una sezione **richiudibile** (`showDetails`, **chiusa in
  creazione** e **aperta in modifica**), sempre montata ma con `hidden`. Quando è chiusa e c'è
  un valore non predefinito, una riga di riepilogo (`detailSummary`) lo segnala. Non rimettere
  quei campi sempre visibili e non togliere l'autofocus: è la ragione per cui il caso normale
  richiede solo l'importo. La validazione resta manuale su `formData`, quindi i campi nascosti
  non bloccano il submit (`noValidate`).
- **⚠️ Separatore decimale: virgola E punto**: i campi importo usano `inputMode="decimal"`, che
  su tastiera italiana mostra la **virgola**: accettare solo `.` faceva scartare silenziosamente
  il separatore (`12,50` → `1250`). Nei form usare `AMOUNT_INPUT_PATTERN` (`/^\d*[.,]?\d*$/`)
  nell'`onChange` e `parseAmountInput` (in `src/utils/formatting.ts`) per il parsing, mai
  `parseFloat` diretto.
- **PWA (nessuna dipendenza esterna)**: manifest in `public/manifest.webmanifest`; icone generate da `scripts/generate-icons.mjs` con `npm run icons` (encoder PNG puro con zlib): **scontrino bianco con bordo a zig-zag** (3 punte, simmetrico) su quadrato smeraldo, con il glifo € in peso regular; il glifo arriva dalla maschera 1-bit `scripts/euro-glyph.mjs` (estratta dal font Liberation Sans Regular, perché Node non ha un rasterizzatore di font) — la versione maskable riempie tutto il canvas (niente trasparenza) con lo scontrino nella zona sicura; service worker `public/sw.js` (navigate network-first + fallback `/index.html`, asset `/assets/`+`/icons/`+manifest cache-first); registrato **solo in produzione** (`import.meta.env.PROD` in `main.tsx`) per evitare cache in dev. Build di produzione: `npm run build` + `npm run preview` (host 0.0.0.0, porta 4173). **Icone versionate (`?v=` = `ICON_VERSION` in `sw.js`)**: vedi il bullet in "Problemi risolti".
- **Redesign UI (fase 1)**: `Header.tsx`/`Header.css` eliminati e sostituiti da `TitleBar` + `ActionMenu` (componenti condivisi) con icone SVG in `src/components/icons.tsx`. Regole: pulsante creazione sempre nella title bar a destra (Main view, Categorie, Conti); view di modifica → title bar con **Conferma (✓)** ed **Elimina (🗑)**, niente Annulla (il Back annulla e torna indietro); view di creazione → **solo Conferma (✓)**; menu azioni a tre righe per azioni extra (Main view: Analisi/Conti/Categorie; Analytics: Esporta CSV). I form non hanno più pulsanti in fondo: la Conferma in title bar invia con `formRef.current?.requestSubmit()` (in ogni form c'è un bottone submit nascosto `.sr-only` per l'invio con Invio). In MainView le righe movimento sono cliccabili (niente pulsanti edit/delete a destra; la delete è spostata nella view di modifica; le righe mostrano il dettaglio: categoria per Spesa, conto per Entrata, sorgente→destinazione per routing).
- **Back button**: usa `navigate(-1)` (default della `TitleBar`) per tornare alla view di origine preservando lo stack. NON usare `onBack` che fanno `navigate('/...')` nelle view di create/edit: pushano una nuova entry e rompono lo stack (es. main→conti→edit: al secondo Back si tornava a edit invece che a main). Verificare sempre con il percorso main→lista→edit→Back→Back.
- **Liste gestione (Conti/Categorie)**: come la Main view, le righe sono cliccabili e aprono la view di modifica (niente pulsanti edit/delete; nelle Categorie il chevron espande/collassa con `stopPropagation`). La delete è solo nella view di modifica (per conti/categorie usa `ConfirmModal` + delete in cascata). Pluralizzazione italiana nei popup: spesa/spese, entrata/entrate, sottocategoria/sottocategorie (non usare il suffisso `'e'` su "spesa"/"entrata").
- **Giacenza iniziale conto (`initialBalance`)**: campo sul modello `Account` (NON un movimento) → non compare in Analytics/Main view (restano puliti, niente skew al primo mese). Il saldo di un conto normale = `initialBalance + cashflows − expenses + rettifiche` (cashflows includono anche le controparti negative dei routing); per uno stash non tracciato, Expenses e Cashflows assegnati non modificano il saldo, mentre `initialBalance` e rettifiche esplicite restano valide. In lettura (`db.getAccounts`/`getAccount`) normalizzare `initialBalance` a 0 per i record esistenti senza campo. In `CreateAccountPage` il campo "Giacenza iniziale (€)" è opzionale (default 0); usarlo come apertura, non per riallineamenti successivi.
- **Rettifiche di saldo conto (`AccountBalanceAdjustment`)**: valido per ogni conto Cash/bancario, record separato da Expense/Cashflow, con importo delta firmato e data effettiva. `initialBalance` resta la giacenza iniziale: non cambiarla per riallineamenti successivi. I saldi conto e Andamento includono le rettifiche dalla data, mentre report/totali Analytics, CSV, Main view e rimborsi le escludono. Backup v3 include `accountBalanceAdjustments`; import v1/v2 mappa il campo assente a lista vuota. Cascade conto rimuove le rettifiche (anche in `deleteAccount`). Il saldo va **sempre** calcolato con `getAccountBalance`/`getAccountBalanceAtDate` di `src/utils/accountBalance.ts` (mai duplicare la formula: include la regola stash e le rettifiche). Le pagine che mostrano rettifiche (e `AnalyticsPage`) devono chiamare `loadAccountBalanceAdjustments()` **senza argomento** nel mount: con l'argomento lo stato condiviso conterrebbe solo le rettifiche di quel conto.
- **Conto preferito (`isPreferred`)**: flag booleano su `Account` (default false, normalizzato in lettura). I conti preferiti vengono mostrati **per primi** nei dropdown e nella lista Conti (con ★); gli elenchi dei conti usano sempre l'helper `sortAccountsPreferred`. Il conto predefinito del selettore principale (form Spesa, Entrata e Ricorrenze) è il **primo conto normale preferito**, con fallback al primo conto normale e poi al primo conto: usare `getDefaultPrimaryAccount` da `src/utils/accounts.ts`. In `CreateExpensePage` il **preferito stash** è invece il default del selettore secondario (se manca, il primo stash disponibile).
- **Stash secondario non tracciato (`isCoinAccount`)**: il flag booleano persistito su `Account` (default false, normalizzato in lettura e in import) indica il tipo del conto. Tutti i conti restano selezionabili come conto principale; gli stash sono anche nel selettore secondario. Le spese e le entrate assegnate a uno stash non ne modificano il saldo, anche se è il conto principale della spesa; Analytics registra sempre l'intera spesa. In UI: dropdown "Tipo di conto" ("Conto normale" / "Stash secondario non tracciato"), spesa = "Pagata in parte da un conto secondario", "Importo dal conto secondario" e "Conto secondario"; badge generico ("2°"). Il flag `isPreferred` è indipendente ma contestuale in Spesa: conto normale preferito = default principale, stash preferito = default secondario; se non c'è un preferito si usa il primo account del tipo. Non cambiare `isCoinAccount` o dati esistenti per la rietichettatura. Se una selezione legacy non è più abilitata, il form la mantiene come opzione di ripiego.
- **Conto stash "Coins" di default**: `initializeDefaultData` in `src/utils/initialization.ts` crea **Cash, Bank account e Coins** (id `acc-coins`, `isCoinAccount: true`, `isPreferred: true`, giacenza 0) sul database vuoto e, con un **backfill idempotente**, anche sui database già esistenti privi di stash, così il selettore "Conto secondario" della spesa non è mai vuoto dopo la generalizzazione del conto monete. Il backfill salta se esiste già uno stash o un conto chiamato "Coins" e non cambia mai il tipo dei conti esistenti. Se poi c'è **un solo stash** e non è preferito, l'app lo imposta come preferito (★) all'avvio: senza il flag il default del secondario sarebbe il **primo stash in ordine alfabetico**, quindi un nuovo stash con nome precedente lo scavalcherebbe; con **più stash e nessun preferito** la scelta resta all'utente (l'app non tocca nulla). NON rimuovere il backfill. Effetto collaterale voluto: se lo stash di default viene eliminato, ricompare al successivo avvio dell'app.
- **Navigazione dopo save/delete (Back button)**: i form create/edit dopo salvataggio/eliminazione usavano `navigate('/...')` (es. `navigate('/accounts')`, `navigate('/expense-types')`, `navigate('/')`) che **pushano una nuova entry** e rompono lo stack del Back (es. main → conti → crea conto → salva → al secondo Back si tornava alla form invece che a main). Usare sempre `useNavigateBack(fallback)` da `src/utils/navigation.ts`: fa `navigate(-1)` se esiste una entry precedente (`window.history.state.idx > 0`), altrimenti usa il fallback (route canonica) per i casi di reload/accesso diretto. NON reintrodurre `navigate('/...')` diretti nei form.
- **Modali: mai native, solo componenti condivisi**: non usare `window.confirm`/`window.alert`/`window.prompt` né `alert()`. Tutte le modali sono componenti React custom: base **`Modal`** (`src/components/Modal.tsx` + `src/styles/Modal.css`, close su backdrop/ESC, `aria-modal`) + wrapper **`ConfirmModal`** (2 bottoni Annulla/Continua) + **`AlertModal`** (1 bottone OK per gli errori). I messaggi transitori/validazioni usano **`Toast`** (prop `icon` per il prefisso, default ✅, usare ⚠️ per i warning). `ConfirmModal.css` non esiste più: gli stili sono in `Modal.css`.
- **Link `routingPairId` (routing e spese con conto secondario non tracciato)**: campo opzionale su `Expense` e `Cashflow` (null = record normale; non serve bump `DB_VERSION`, normalizzato in lettura in `database.ts` e in import in `backup.ts`). Entrambi i leg di un routing condividono lo stesso `routingPairId`; `src/utils/routing.ts` usa il **link esplicito** per `isRoutingCashflow`/`routingCounterpartIds` con **fallback euristico** (data+ora+importo) per i record legacy senza link. Regola detection: cashflow con `routingPairId` AND (`routingAccountId` set OR `amount < 0`) = leg routing; cashflow **positivo** con `routingPairId` senza `routingAccountId` = entrata interna del gruppo conto secondario (da nascondere nelle liste, ma conteggiata in Analytics — opzione A). In `CreateCashflowPage` il routing: create → 2 leg con lo stesso pair id; edit → preserva il pair id e **rimuove la vecchia controparte negativa** (fix orfani: prima restavano negativi fantasma cambiando data/ora/importo); delete → rimuove il counterpart via link (fallback euristico se legacy). Per cercare i cashflow del gruppo usare `getCashflows` (dal context) filtrando per `routingPairId`.

- **`movements` del context = TUTTI i movimenti del periodo**: `loadMovements` NON nasconde
  i cashflow interni (controparti negative dei routing ed entrate interne dei conti secondari).
  Il nascondimento è un filtro di **visualizzazione** per-view: `MainView` e la lista
  report/CSV di `AnalyticsPage` usano `routingCounterpartIds`; i **totali** di Analytics
  usano `isRoutingCashflow` (l'entrata interna del conto secondario CONTA in Total Cashflow —
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
- **Ricerca Luogo e GPS**: nel form spesa, la digitazione di almeno 3 caratteri nel campo
  Luogo mostra suggerimenti da **Photon** (`https://photon.komoot.io/api/`) dopo 500 ms di
  debounce; annullare la richiesta obsoleta, supportare tastiera/tocco e attribuire Photon +
  OpenStreetMap. La query digitata è inviata al servizio esterno; errori/offline lasciano
  utilizzabile il campo manuale. Il luogo è obbligatorio nel form Spesa ed è tra i primi
  campi; "Online / nessun luogo" è una checkbox e il valore esplicito salvato per gli acquisti
  senza posto fisico. In creazione, avviare automaticamente `watchPosition`; fermarlo al
  primo fix, quando l'utente digita/seleziona Online o all'unmount, e annullare anche il
  reverse-geocoding obsoleto. In modifica il GPS non parte automaticamente. Errori GPS/rete
  mostrano un `Toast` ⚠️ e lasciano disponibili digitazione e scelta Online. Dopo un luogo
  Photon/GPS (o l'inserimento esatto di un luogo già usato), `utils/locationCategories.ts`
  identifica la categoria più frequente già associata localmente allo stesso luogo;
  altrimenti usa una mappatura conservativa tipo OSM → nome categoria (ristorazione, negozi,
  carburante, pedaggi). Se la categoria è identificata, selezionarla automaticamente e
  informare con un toast; non sovrascrivere mai una categoria scelta manualmente. In caso di
  parità, categoria mancante o luogo online non assegnare una categoria. Non inviare mai lo
  storico spese al servizio. La posizione di casa si configura da Main view → Azioni →
  Posizione casa; il GPS si acquisisce su pressione esplicita e l'accuratezza è mostrata prima
  della conferma (non mostrare le coordinate numeriche). Coordinate in `localStorage` solo su
  questo browser, non nel backup e non inviate a servizi esterni. Confrontare il fix GPS con
  una distanza haversine di 100 m prima di chiamare Nominatim; dentro il raggio selezionare
  "Online / nessun luogo" e lasciare il checkbox modificabile. Rendere disponibili le azioni
  per aggiornare/rimuovere la posizione salvata.
  Nelle conferme delle spese ricorrenti, se il template non ha un luogo usare
  `Online / nessun luogo` come default modificabile per la singola occorrenza; la conferma
  in blocco usa lo stesso default per i template senza luogo. Il bottone 📍 permette di
  ripetere il rilevamento manualmente; usa `navigator.geolocation.watchPosition` +
  **Nominatim** online
  (`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=..&lon=..&zoom=18&accept-language=it`).
  Nominatim è usato solo per reverse geocoding dopo il fix GPS; la sua API pubblica vieta
  autocomplete lato client.
  Geolocation richiede **secure context** (HTTPS o localhost; NON su HTTP su IP di rete).
  Gestire errore/permesso negato/timeout/offline con `Toast` ⚠️ e lasciare il campo
  modificabile; l'utente può inserire il luogo o scegliere Online senza attendere il GPS.
  Errore GPS: codice 1 = permesso negato, 2 = posizione non disponibile, 3 = timeout.
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
  conto secondario) e `Cashflow.isSalary` (checkbox "Stipendio" nel form entrata), default false,
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
- **Vista Rimborsi in attesa**: accessibile dal menu Azioni della Main view, elenca le spese
  rimborsabili strettamente successive all'ultimo stipendio precedente a oggi (tutte se non
  esiste uno stipendio) usando `getOutstandingReimbursableExpenses` in
  `src/utils/reimbursements.ts`, la stessa finestra temporale di `getReimbursableSummary`.
  Ogni riga apre la modifica della spesa; non introdurre uno stato persistente "rimborsata".
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
- **Entrate ricorrenti / programmate (`RecurringExpense.kind`, frequenza `once`)** (19/09/2026):
  le Ricorrenze coprono anche le **entrate** con **un'unica entità**: `kind: 'expense' |
  'income'` (default `expense`, normalizzato in lettura in `normalizeRecurringExpense` e in
  import in `backup.ts` → **niente bump `DB_VERSION`**), più `isSalary` (solo entrate) e i
  campi link **`recurringId`/`recurringPeriod` anche su `Cashflow`** (normalizzati in
  `normalizeCashflow`/backup). Regole da non violare:
  - la conferma crea un **`Cashflow`** se `kind === 'income'`, un `Expense` altrimenti
    (`confirmMany` in AppContext); **`deleteCashflow` deve azzerare `lastConfirmedPeriod`**
    del template (come fa `deleteExpense`), altrimenti la prevista non ritorna;
  - l'undo in blocco ricorda il **tipo** dei record creati (`ConfirmedRecurringMovement` in
    `lastRecurringConfirmation.records`): non tornare a una lista di soli expenseIds;
  - `deleteRecurringExpense` e `deleteRecurringByIndex` (cascade conto) devono scollegare
    anche i **Cashflow** (transazioni estese alla store `cashflows`);
  - **period key dalla SCADENZA, non da oggi**: usare `getOccurrencePeriodKey(template, ref)`
    (in `utils/recurrence.ts`) in conferma/skip/guardia. Con `once` la chiave è la **data
    pianificata**: usando la data odierna la prevista si ripresenterebbe ogni giorno;
  - frequenza **`once`** = period key = la data pianificata, `getNextDueDate` = la data stessa,
    nessuna domanda "Tutte le successive" quando cambia l'importo a conferma;
  - Analytics: pseudo-bucket **`EXPECTED_INCOME_ACCOUNT_ID` / "Entrate previste"** (grigio nei
    grafici, verde in lista) contato in **Totale Entrate** e Saldo, mai nei saldi conto né
    nella linea reale di `BalanceTrendChart`; entrate e spese previste sono incluse solo
    nella linea tratteggiata della proiezione.
- **Grafico "Andamento del saldo" (Analytics, switch a 3 viste)**: vista `Andamento` con
  `src/components/BalanceTrendChart.tsx` (SVG a linee, classi CSS `trend-*`). Il **saldo di
  apertura** = `initialBalance` dei conti in scope + i contributi dei movimenti precedenti al
  periodo (formula normale `initialBalance + cashflows − expenses + adjustments`; gli importi
  spesa sono positivi e vanno sottratti); i movimenti assegnati a stash non tracciati non
  modificano il saldo. Usa i `movements` completi, quindi controparti dei routing ed
  entrata interna del conto secondario non tracciato, così il saldo al giorno corrente coincide con i saldi reali
  dei conti. La linea reale è continua e blu; la linea prevista è tratteggiata viola e include
  le ricorrenze future e i movimenti reali con data futura. Marker e tooltip distinguono
  spese previste rosse ed entrate previste verdi. La proiezione arriva alla fine del periodo
  selezionato e per "Tutto" è limitata a 12 mesi; i periodi passati mostrano la sola linea
  reale. Ricorrenze in pausa/confermate/saltate non sono proiettate; le scadenze già maturate
  ma ancora pendenti entrano nella previsione da oggi (mai retroattivamente). Filtro Categoria
  = applicato alle sole spese; i cashflow non hanno categoria. I saldi conto non sono mai
  modificati dalle previsioni. Tooltip con `onPointerMove`/`onPointerDown` sull'intero SVG
  (funziona anche al tocco) e classi `left`/`right` per non uscire dal viewport.
- **Grafici Analytics: come sono scelti**: `isMonthView` → `MonthBreakdownChart` (barre per
  conto/categoria); gli altri periodi → `MovementsChart` (giornaliero impilato); la vista
  `Andamento` è indipendente dal periodo (`BalanceTrendChart`). La vista `Tendenze` usa
  `buildExpenseTrends`/`ExpenseTrendsChart`: mese corrente + 11 precedenti, media su tutti i
  12 mesi, confronto delle medie degli ultimi 3 con i 3 precedenti, applica i filtri conto e
  categoria ma ignora il filtro periodo, conta solo spese registrate (incluse rimborsabili;
  escluse le previste). Le viste in `AnalyticsPage` sono
  `report | grafico | andamento | tendenze`.
- **Title bar affollata su smartphone (Analytics)**: i tre pulsanti toggle
  Report/Grafico/Andamento occupavano tutta la barra (a 390px il titolo si comprimeva a 1px e
  il Back sembrava sparire). Regola: nella title bar tenere pochi controlli a destra; per gli
  switch multipli usare un **menu a pill** (`ActionMenu` con `trigger` custom + classi
  `.filter-menu`/`.filter-value`, come il pulsante Filtri della Main view) passato a
  `TitleBar` tramite lo slot **`extraActions`** (aggiunto il 19/09/2026). Il kind `toggle` di
  `TitleBarAction` è stato rimosso perché non più usato.
- **Falso "Nessun movimento" all'avvio (fix 19/09/2026)**: la Main view mostrava l'empty state
  subito dopo il load (per un attimo, o per qualche secondo su smartphone) e i dati
  comparivano solo toccando un filtro. Due cause concorrenti:
  (1) `isLoading` era un **unico booleano** condiviso da
  `loadAccounts`/`loadExpenseTypes`/`loadExpenses`/`loadCashflows`/`loadRecurringExpenses`/
  `loadMovements`: il primo che terminava lo riportava a false mentre i movimenti erano
  ancora in caricamento;
  (2) al **primo paint** `isLoading` è false e `movements` è vuoto → l'empty state compariva
  prima ancora che partisse il caricamento.
  Fix in `AppContext`: `isLoading` ora deriva da un **contatore** `pendingLoads`
  (`beginLoad`/`endLoad`, resta true finché tutti i caricamenti non sono conclusi) e c'è il
  flag **`movementsLoaded`** (false finché il primo `loadMovements` non è concluso);
  `MainView` e `AnalyticsPage` mostrano lo spinner se `!movementsLoaded`. ⚠️ Non tornare a
  un booleano condiviso: è la causa del falso empty state. Riprodotto in modo deterministico
  con CPU throttling 20x + `MutationObserver` sulle classi `.empty-state`/`.loading-state`:
  prima `EMPTY → LOADING → EMPTY → GROUPS`, dopo il fix solo `LOADING → GROUPS`.
- **Icona dell'app aggiornata ma non visibile (fix 04/10/2026)**: dopo la rigenerazione
  delle icone (stesso nome file = stesso URL) il browser continuava a mostrare quella
  vecchia, **anche come favicon da browser**. Causa: `/icons/` è servito dal SW in
  **cache-first**, quindi `caches.match(request)` restituiva per sempre i byte vecchi (la
  cache HTTP di GitHub Pages è `max-age=600`, non c'entrava). Fix: URL delle icone
  **versionati** (`icons/icon-192.png?v=N`, oltre a `icon-180.png` per l'apple-touch-icon e
  alle tre voci del manifest) — con un URL nuovo il vecchio cache non matcha più e la
  richiesta va in rete; inoltre il manifest cambia, così Android può aggiornare l'icona
  dell'app installata. La versione sta in **tre punti da bumpare insieme**: `ICON_VERSION`
  in `public/sw.js`, i `<link>` in `index.html`, i `src` in `public/manifest.webmanifest`.
  Il SW ora **precacha anche le icone** all'install (`cache: 'reload'` per scavalcare
  l'HTTP cache) e la sua cache è bumpata a `expense-tracker-v3` (bumpare il nome a ogni
  cambiamento della strategia: `activate` elimina le cache vecchie). Verificato con un
  test nel browser: con un'icona stale sotto l'URL non versionato, l'URL `?v=2` torna i
  byte nuovi (hash `4a3e3e9e…`). Nota: l'icona della **PWA già installata** si aggiorna
  quando il browser rilegge il manifest cambiato; su iOS (snapshot statico) può servire
  rimuovere e ri-aggiungere l'app alla home.

## Limiti noti (non bloccanti)
*(Nessun limite noto aperto al 19/09/2026: quello della Main view al primo load freddo è
stato risolto — vedi "Problemi risolti".)*

## Note di database (da `spec.md`)
- Tabelle: `Expense`, `Cashflow`, `ExpenseType`, `Account` (DB locale); `RecurringExpense` (store `recurringExpenses`) da `DB_VERSION` 2 e `AccountBalanceAdjustment` (store `accountBalanceAdjustments`) da `DB_VERSION` 3.
- Valori iniziali Account: Cash, Bank account, Coins (stash non tracciato, preferito).
- Valori iniziali ExpenseType: Dinner, Shopping, Fuel, Tolls.
- Importi *abbreviate*: in K oltre 999, in M oltre 999.999, con 2 decimali.
