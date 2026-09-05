# Plan — Expense Tracker AI

> Piano di attività per lo sviluppo della webapp.
> Regole: gli step completati vengono **marcati come completati ma mai cancellati**.
> Ogni nuova feature o correzione di bug va aggiunta qui.

## ✅ Completati

- [x] **Setup progetto**: React + TypeScript + Vite, struttura a componenti e routing
- [x] **Database locale (IndexedDB)**: store per `Account`, `ExpenseType`, `Expense`, `Cashflow`
- [x] **Dati iniziali**: Account (Cash, Bank account), ExpenseType (Dinner, Shopping, Fuel, Tolls)
- [x] **Main view**: lista movimenti con importi colorati (rosso spese, verde cashflow, giallo routing), pulsanti Edit/Delete, ordinamento data/ora discendente, paginazione con scroll infinito
- [x] **Filtri data range** in Main view (mese corrente, mese precedente, anno corrente, tutti)
- [x] **Create/Edit Expense**: form con data, importo, dropdown Account, dropdown ExpenseType con creazione inline (badge "new")
- [x] **Create/Edit Cashflow**: form con data, importo, Account, Routing Account opzionale e creazione doppio movimento
- [x] **ExpenseType management**: albero gerarchico con Edit/Delete e totale per categoria
- [x] **Account management**: lista account con ultimo movimento, Edit/Delete
- [x] **Analytics**: filtri, sommario numerico (Total Expenses, Total Cashflow, Net Balance, Top 3 Categories), report movimenti filtrati
- [x] **Campo tempo hh:mm:ss**: aggiunto ai form Expense e Cashflow, persistito nel DB e mostrato nella lista movimenti della Main view (ordinamento per data+ora)
- [x] **Seed dati default idempotente**: `initializeDefaultData` ora è concurrency-safe (promise condivisa), niente più `ConstraintError` al doppio avvio in dev
- [x] **Delete Account/ExpenseType con cascata**: la delete elimina anche i movimenti collegati (spese e cashflow) e mostra i **totali importo** nel nuovo popup critico `ConfirmModal`
- [x] **Edit Cashflow**: pre-carica i dati esistenti in modalità edit (via `getCashflow`); gestito anche l'edit con routing account
- [x] **Total Cashflow Analytics**: esclude i cashflow di routing dal totale (come da spec) — esclusi sia il movimento ricevente (con `routingAccountId`) sia la controparte negativa (stessa data/ora/importo)
- [x] **Net Balance Analytics**: formula corretta in `Total Cashflow - Total Expenses` (gli importi spesa sono memorizzati positivi; prima il segno risultava sbagliato)
- [x] **Totale ExpenseType gerarchico**: include le spese dei figli nella gerarchia
- [x] **Espansione/collasso albero ExpenseType**: clic sul nodo per espandere/comprimere i figli (chevron)
- [x] **Localizzazione UI in italiano**: tutte le etichette UI tradotte (menu, form, popup, stati vuoti, messaggi). Termini: Spesa/Entrata, Conti, Categorie, Analisi, Saldo. I dati seed (nomi account/categorie) restano come da spec
- [x] **Export CSV**: pulsante "Esporta CSV" nella view Analytics che scarica i movimenti filtrati (rispetta i filtri periodo/conto/categoria); formato italiano (`;` separatore, `,` decimale, BOM UTF-8), spese con segno negativo
- [x] **Main view — pulsanti Edit/Delete a destra**: i pulsanti modifica/elimina sono sempre visibili a destra di ogni movimento (come Categorie e Conti), eliminata la selezione per mostrarli
- [x] **Categories/Account — edit e create in nuova view**: i tasti edit e create aprono una **nuova pagina** (`/expense-type/new|:id/edit`, `/account/new|:id/edit`) per compilare i dati e confermare/annullare; al ritorno la lista si aggiorna (route aggiunte in App.tsx)
- [x] **Average Daily Expense corretto**: divisione per **giorni del periodo** (da `getDateRange`), non più per transazione; fix off-by-one con `Math.floor`; etichetta "Media Spesa Giornaliera" + "per giorno", colore rosso
- [x] **Race condition all'avvio (seed vs lettura)**: `AppContext` ora attende `initializeDefaultData` prima di caricare account/categorie (su DB vuoto i dropdown restavano senza conti)
- [x] **Filtri Analytics completi**: aggiunti periodi `previous-year` (Anno scorso) e `last-5-years` (Ultimi 5 anni); selezione **multipla** per Categorie e Conti (componente `MultiSelectFilter` a checkbox, selezione vuota = tutti); filtro categoria espande i figli nella gerarchia
- [x] **Grafico Analytics**: view Analytics con **switch Report/Grafico** (due pulsanti); il grafico è un diagramma a barre divergente SVG (senza librerie) con totali giornalieri di Entrate (verde, sopra) e Spese (rosso, sotto), esclusi i cashflow di routing; tooltip per i valori. `spec.md` aggiornata
- [x] **Grafico per categoria di spesa**: nel grafico, le spese sono **barre impilate per categoria** (colore distinto per ogni categoria, legenda colori, tooltip con nome categoria e importo), oltre al totale giornaliero; `spec.md` aggiornata
- [x] **Grafico mese: barre separate per conto/categoria**: nelle viste a mese singolo ("Questo mese"/"Mese scorso") il grafico mostra **barre separate** (una per conto/categoria) invece di impilate; per gli altri periodi resta il grafico giornaliero impilato; nuovo componente `MonthBreakdownChart`; `spec.md` aggiornata
- [x] **Main view routing**: i cashflow con routing mostrano **un solo** movimento (il ricevente, in giallo); la controparte negativa sul conto di routing viene nascosta nella lista. Logica centralizzata in `src/utils/routing.ts` (`isRoutingCashflow`, `routingCounterpartIds`) e riusata da Analytics
- [x] **Toast alla creazione inline ExpenseType**: quando si crea una categoria inline nel form spesa compare un **toast** di conferma ("Categoria ... creata") che si auto-nasconde dopo ~2.5s; componente `Toast` con stile globale
- [x] **Importi abbreviati ovunque**: usare `abbreviateAmount` in Analytics (sommario, top categorie, report movimenti) e nelle pagine di gestione (totali categoria, ultimo movimento account) al posto di `.toFixed(2)€`; i totali del popup `ConfirmModal` per delete restano volutamente precisi
- [x] **PWA installabile**: `manifest.webmanifest`, icone generate senza dipendenze (`npm run icons`, script `scripts/generate-icons.mjs`), service worker `public/sw.js` (navigazione network-first + fallback app shell; asset statici cache-first), registrazione solo in produzione, meta PWA in `index.html`, build di produzione servita con `npm run preview` (0.0.0.0:4173)
- [x] **Redesign interfaccia grafica (fase 1 — componenti shared, Main view, Analytics)**: nuova `TitleBar` condivisa (titolo a sinistra + Back, azioni a destra) e `ActionMenu` (dropdown a tre righe) con icone SVG (`src/components/icons.tsx`); pulsante creazione sempre nella title bar a destra (Main view, Categorie, Conti); title bar view di modifica con **Conferma ✓ + Elimina 🗑** (niente Annulla: il Back annulla e torna indietro); title bar view di creazione con **sola Conferma ✓**; menu azioni a tre righe in Main view (Analisi/Conti/Categorie) e Analytics (Esporta CSV); switch **Report/Grafico** nella title bar di Analytics; Main view con action bar **Filtri** (imbuto) / **Azioni** (tre righe) a dropdown; lista movimenti **cliccabile senza pulsanti edit/delete** con dettagli per tipo (categoria per Spesa, conto per Entrata, sorgente→destinazione per routing) e delete spostata nella view di modifica; eliminati `Header`/`Header.css` (sostituiti da `TitleBar`); `spec.md` e `plan.md` aggiornati
- [x] **Liste gestione (Conti/Categorie) come la Main view**: rimosse le righe Edit/Delete dalle liste di Account e ExpenseType management; ogni riga è cliccabile e apre la view di modifica (nelle Categorie il chevron continua a espandere/collassare i figli); la delete resta disponibile nella view di modifica (ConfirmModal in cascata per conti/categorie); fix pluralizzazione nei popup di delete (spesa/spese, entrata/entrate, sottocategoria/sottocategorie); `spec.md` aggiornata
- [x] **Fix Back button (stack di navigazione)**: rimosse le `navigate` pushanti dalle view di create/edit (ora usano il default `navigate(-1)` della `TitleBar`); il Back torna alla view di origine preservando lo stack (es. main → conti → edit conto: Back → conti, Back → main, non di nuovo edit conto). Verificato nel browser; aggiunta regola **Back button navigation** in `spec.md`
- [x] **Main view — allineamento lista movimenti**: fix del conflitto CSS (la classe `.movement-info` di `AnalyticsPage.css` sovrascriveva quella della Main view rendendola colonna centrata); ora data, ora e descrizione sono **allineati a sinistra** (`.movement-info` esplicito in riga); classe Analytics rinominata in `.movement-detail-info`
- [x] **Edit Expense — larghezza campo Categoria (ExpenseType)**: aggiunto `width: 100%` a `.form-input`/`.form-select` in `ExpenseForm.css` e `CashflowForm.css`; il campo categoria ora è largo come gli altri campi del form
- [x] **Distanziare i pulsanti Delete e Save in tutte le view**: aggiunto `margin-right: 18px` al pulsante danger (Elimina) nella `TitleBar`; distanza tra Elimina e Conferma ~26px (prima ~8px) per evitare pressioni accidentali
- [x] **Giacenza iniziale conti (`initialBalance`)**: nuovo campo `initialBalance` sull'`Account` (default 0, normalizzato in lettura per i conti esistenti); campo **"Giacenza iniziale (€)"** in creazione/modifica conto; nella **gestione Conti** mostrato il **saldo corrente** (`initialBalance + cashflows − expenses`, abbreviato e colorato per segno) accanto al conto; Analytics invariati (la giacenza non è un movimento, nessuno skew al primo mese); `spec.md` aggiornata
- [x] **Conto preferito (`isPreferred`)**: nuovo flag `isPreferred` sull'`Account` (default false, normalizzato in lettura); checkbox **"Conto preferito"** in creazione/modifica conto; i conti preferiti vengono mostrati **per primi** nei dropdown di inserimento Spese/Entrate (il primo preferito è il default, es. Bank account nel seed) e nella lista Conti con ★; nuovo util `src/utils/accounts.ts` (`sortAccountsPreferred`); `spec.md` aggiornata
- [x] **Fix navigazione dopo save/delete (Back button)**: dopo aver salvato o eliminato da una view create/edit la navigazione usava `navigate('/...')` (push) che inquinava lo stack del browser e rompeva il Back (es. main → conti → crea conto → salva → al secondo Back si tornava alla form invece che a main). Ora save/delete usano `navigate(-1)` per tornare alla view di origine preservando lo stack; nuovo helper `src/utils/navigation.ts` (`useNavigateBack`) con fallback alla route canonica quando non c'è storia precedente (reload/accesso diretto). Applicato a create/edit di Account, ExpenseType, Expense e Cashflow. Verificato nel browser: main → conti → crea conto → salva → Back → main; main → categorie → crea categoria → salva → Back → main; `spec.md` aggiornata
- [x] **Sostituite le modali native con modali custom (componenti shared)**: eliminati `window.confirm` (delete Spesa/Entrata) e tutte le `alert()` (validazione/errori) dai 4 form create/edit. Nuovo componente base **`Modal`** (`src/components/Modal.tsx` + `src/styles/Modal.css`: overlay + titolo + contenuto + azioni, chiusura su backdrop/ESC, `aria-modal`); **`ConfirmModal`** ora è un wrapper sopra `Modal` (2 bottoni) usato per delete di Account, ExpenseType, **Spesa ed Entrata**; nuovo **`AlertModal`** (1 bottone OK) per gli errori (salvataggio/caricamento/eliminazione); le validazioni campi obbligatori usano il **`Toast`** (nuova prop `icon`, ⚠️ per i warning); eliminato `ConfirmModal.css` (stili spostati in `Modal.css`); `spec.md` aggiornata
- [x] **Importo con tastiera numerica su smartphone**: aggiunto `inputMode="decimal"` al campo **Importo (€)** dei form Spesa (`CreateExpensePage`) ed Entrata (`CreateCashflowPage`), come nel campo "Giacenza iniziale (€)" dei conti — su smartphone si apre la tastiera numerica
- [x] **Backup/Ripristino database (Export/Import JSON)**: nuove voci "Esporta backup" / "Ripristina backup" nel menu Azioni della Main view. **Export**: scarica un file JSON (`expense-tracker-backup-YYYY-MM-DD.json`) con tutti e 4 gli store (Account, ExpenseType, Expense, Cashflow), date ISO, indipendente dall'origine. **Import**: selezione file → `ConfirmModal` di avviso ("sostituirà tutti i dati") con conteggi → sostituzione **atomica** (clear + insert nella stessa transazione IndexedDB, `db.importAllData`) → reload dello stato (conti, categorie, spese, entrate, movimenti) via `restoreBackup` in `AppContext`; file non validi → `AlertModal`; successo → `Toast`. Nuovo `src/utils/backup.ts` (`exportDatabase`, `readBackupFile` con normalizzazione di `initialBalance`/`isPreferred`/`parentId`/`routingAccountId` e riconversione date ISO → `Date`). Necessario perché IndexedDB è legato all'origine: al passaggio a HTTPS i dati non vengono ereditati. Verificato in browser (:5173, round-trip con gerarchia categorie, routing, conto preferito e giacenza; file invalido rifiutato senza toccare i dati). `spec.md` aggiornata

- [x] **Spesa pagata in parte con monete (secondo conto — coin split)**: nuova feature per
      registrare la spesa TOTALE vera facendo scalare al conto principale solo la parte
      non-monete (un conto "Monete" resta sempre a 0, stash non tracciato). Implementazione:
      campo `routingPairId` su `Expense`/`Cashflow` con **link esplicito** (fallback
      euristico per dati legacy, niente bump `DB_VERSION`); `routing.ts` basato sul link;
      operazioni atomiche del gruppo (`createExpenseGroup`/`updateExpenseGroup`/
      `deleteExpenseGroup`); `saveExpenseWithCoins` in AppContext + `buildCoinSplitCashflows`
      (`src/utils/coins.ts`); campi "Pagato in parte con monete" nel form spesa (preview,
      validazioni); click riga gialla → modifica spesa; **Analytics opzione A** (l'entrata
      interna conta: `movements` del context = TUTTI i movimenti, filtraggio display per-view
      in MainView/Analytics, mai in `loadMovements`); delete a cascata conti/categorie senza
      leg orfani; backup normalizzato. Verificato E2E nel browser. Spec in `spec.md`
      (sezione "Expense paid partly from a second account (coin split)"), regole in
      `AGENTS.md`.

- [x] **Conto monete (flag `isCoinAccount`)**: nuovo flag su `Account` (default false,
      normalizzato in lettura/import) per marcare il conto "monete"; checkbox "Conto monete"
      nell'anagrafica conto; badge 🪙 nella gestione Conti; nel form spesa il dropdown
      "Conto monete" elenca **solo** i conti con il flag (niente più elenco di tutti i conti),
      con hint quando non ce ne sono e opzione di ripiego per selezioni legacy. Verificato E2E
      nel browser. Spec in `spec.md`, attività in `AGENTS.md`.
- [x] **Pubblicazione su GitHub Pages (HTTPS)**: deploy automatico con GitHub Actions
      (`.github/workflows/deploy.yml`: build con `BASE_URL=/expense_tracker/` e
      pubblicazione di `dist/` su `gh-pages`, Pages → Source: GitHub Actions); base path
      configurabile in `vite.config.ts` (`process.env.BASE_URL`, default `/`);
      routing con **`HashRouter`** (URL `#/...`) perché GitHub Pages non riscrive le route
      SPA (Back/stack invariati); service worker e manifest resi indipendenti dal path:
      `public/sw.js` usa `self.registration.scope`, manifest con `start_url`/`scope` e icone
      relative, `index.html` con `%BASE_URL%` per manifest/icone, registrazione SW con
      `import.meta.env.BASE_URL`. Verificato: build locale alla root OK (base default).
      Nota migrazione dati in `README.md` (IndexedDB è legato all'origine → esportare il
      backup da localhost e ripristinarlo sul nuovo dominio github.io).
- [x] **Note + Luogo sulle spese + Luogo da GPS**: nuovi campi facoltativi `notes` e
      `location` su `Expense` (default '', normalizzati in lettura in `normalizeExpense` di
      `database.ts` e in import in `backup.ts`, niente bump `DB_VERSION`). Sezione
      "Informazioni aggiuntive (opzionale)" nel form spesa (crea+edit) con campo **Note**
      (textarea) e campo **Luogo** (input) affiancato da un bottone 📍: `navigator.
      geolocation.getCurrentPosition` → reverse geocoding **Nominatim** online
      (`.../reverse?format=jsonv2&lat=..&lon=..&zoom=18&accept-language=it`) → nome luogo
      compilato (modificabile). Fallback gestiti con Toast ⚠️ (permesso negato / posizione
      non disponibile / timeout / errore di rete): il campo resta manuale e il salvataggio
      non viene mai bloccato (luogo facoltativo). Geolocation richiede secure context
      (HTTPS/localhost; su GitHub Pages OK). Nuova icona `LocateIcon` in `icons.tsx`,
      spinner durante il rilevamento, stili in `ExpenseForm.css`. I campi non influenzano
      Analytics né i saldi. Verificato E2E nel browser (crea spesa con note/luogo, edit
      pre-caricato, GPS con errore → toast, GPS con posizione finta → luogo reale da
      Nominatim). Spec in `spec.md` (sezione "Notes and location on an Expense").
- [x] **Main view — lista per giorno con righe dettaglio (niente data/ora)**: la lista
      movimenti della Main view è ora **raggruppata per giorno in tutti i filtri** e le righe
      mostrano **solo i dettagli** (mai data/ora; l'ora conta solo per l'ordinamento):
      Spesa = "💸 Categoria · Conto" (+ seconda riga 📍 Luogo se compilato), Entrata = conto,
      routing = sorgente → destinazione; importi colorati. Header giorno: compatto nei filtri
      a mese singolo ("4 ven", oggi "· Oggi"), con mese per esteso in Quest'anno/Tutti
      ("Settembre 5 Sab", anno aggiunto per giorni fuori dall'anno corrente in "Tutti").
      Paginazione a gruppi giorno interi (mai un giorno tagliato; auto-load quando il
      contenuto non riempie il viewport). Nuovi helper in `src/utils/formatting.ts`
      (`isSameDay`, `isToday`, `formatDayHeader`), logica in `MainView.tsx`, stili in
      `MainView.css`. Verificato E2E nel browser (header compatto/esteso, oggi, luogo su
      seconda riga, giorno con 22 spese mai tagliato). Design da
      `docs/wireframes/mainview-list.svg`; spec in `spec.md` ("Movement list grouped by day").

## 🔄 In corso / Prossimi

> Entrambe le attività di questa sezione sono **completate** (vedi sezione ✅ Completati).

### Conto monete (flag isCoinAccount) — completata

> Rifinitura UX della feature "spesa con monete": nel dropdown "Conto monete" del form spesa
> mostrare solo i conti marcati come conto moneta nell'anagrafica (flag `isCoinAccount`),
> non tutti i conti. Stesso pattern di `isPreferred` (opzionale, normalizzato in lettura,
> niente bump DB_VERSION).

- [x] **DB + types**: campo `isCoinAccount: boolean` su `Account` (default false), normalizzato
      in lettura in `database.ts` (`getAccounts`/`getAccount`) e in import in `backup.ts`;
      seed account aggiornati (`isCoinAccount: false`)
- [x] **CreateAccountPage**: checkbox "Conto monete (usato come conto per le monete nelle
      spese)" (crea+edit), salvata in `isCoinAccount`
- [x] **AccountManagementPage**: badge 🪙 accanto ai conti moneta (come la ★ dei preferiti)
- [x] **CreateExpensePage**: dropdown "Conto monete" filtrato a `isCoinAccount` (escluso il
      conto principale; opzione di ripiego per mantenere una selezione legacy se il flag è
      stato rimosso); hint "Nessun conto monete: crealo dalla gestione Conti" se non ce ne sono
- [x] **Test E2E** nel browser: senza conti flaggati dropdown vuoto + hint; conto Monete con
      flag → badge 🪙 in Conti e dropdown monete con solo "Monete"; spesa con monete creata
      (Main view 2 righe); build OK

### Spesa pagata in parte con monete (secondo conto) — completata

> Spec: sezione "Expense paid partly from a second account (coin split)" in `spec.md`.
> Obiettivo: registrare la spesa TOTALE vera in Analytics, facendo scalare al conto
> principale (banconote) solo la parte non-monete; un conto "Monete" resta sempre a 0
> (stash di monete non tracciato). Opzione A scelta (l'entrata interna conta nelle Entrate,
> Net coerente coi saldi); Main view a 2 righe (entrata interna nascosta).

- [x] **DB — campo `routingPairId`**: aggiunto su `Cashflow` (leg di routing) e su `Expense`
      (gruppi spesa con monete), normalizzato in lettura (null per i record esistenti in
      `src/db/database.ts`); logica in `src/utils/routing.ts` passa dal matching
      data+ora+importo al **link esplicito**, con **fallback euristico** per i dati
      preesistenti (scelta: fallback, niente bump `DB_VERSION` — massima sicurezza per i
      dati già presenti). Wiring del link anche nei routing normali: `CreateCashflowPage`
      crea i 2 leg con lo stesso `routingPairId`, in edit preserva il pair id e rimuove la
      vecchia controparte negativa (fix orfani), in delete la rimuove via link; nuovo
      `getCashflows` nel context; normalizzazione `routingPairId` anche in `backup.ts`.
      Verificato nel browser: crea/edit/delete routing con link, fallback dati legacy
      (lista 1 riga gialla, esclusione da Analytics), build OK
- [x] **DB — operazioni atomiche gruppo spesa-con-monete**: in `database.ts` nuove funzioni
      `createExpenseGroup` / `updateExpenseGroup` / `deleteExpenseGroup` che creano/aggiornano/
      eliminano il gruppo (Expense + entrata interna + coppia routing) in **un'unica
      transazione** su `expenses` + `cashflows` (all-or-nothing: un errore annulla tutto).
      Verificato in browser su :5173 (import del modulo via Vite dev): create (1+3 record),
      atomicità (id duplicato → abort, nessun record parziale), update (vecchi cashflow
      sostituiti), delete (0/0); build OK
- [x] **`AppContext` — metodi spesa con monete**: nuovo metodo **`saveExpenseWithCoins`**
      (create + edit del gruppo via link: riconcilia vecchi/nuovi cashflow, preserva il pair
      id in edit, rimuove il gruppo se togli le monete, lo crea se le aggiungi); helper
      `buildCoinSplitCashflows` in `src/utils/coins.ts`; `deleteExpense` elimina anche i
      cashflow del gruppo; `deleteAccountCascade` ora rimuove i cashflow del gruppo
      (conto principale O conto monete) e **scollega** le spese del gruppo non sul conto
      eliminato (niente leg orfani); `deleteExpenseTypeCascade` pulisce i gruppi delle spese
      eliminate; `getAccountDeleteInfo` conta anche i cashflow del gruppo (popup accurato).
      `loadMovements` nasconde l'entrata interna (già coperto da `routingCounterpartIds`
      dello step 1). Verificato nel browser: 2 righe in Main view (spesa + routing giallo,
      entrata nascosta), saldi Cash −(totale−monete) e Monete 0, delete conto principale
      (gruppo intero via) e delete conto monete (cashflow via + spesa scollegata), delete
      spesa con monete (gruppo via); build OK
- [x] **`CreateExpensePage` — campi "pagato in monete"**: sezione opzionale "Pagato in parte
      con monete" con **Importo in monete (€)** + **Conto monete** (dropdown che esclude il
      conto principale); anteprima dei 3 movimenti quando attiva; validazioni (importo
      monete > 0 se conto scelto, conto richiesto se importo > 0, importo ≤ totale);
      salvataggio via **`saveExpenseWithCoins`**; in edit pre-carica i campi monete dal
      gruppo (entrata interna via `routingPairId`); rimozione monete → spesa semplice,
      aggiunta → crea gruppo; delete elimina il gruppo (già in `deleteExpense`). Verificato
      nel browser: crea con monete (2 righe in Main view, 1+3 record stesso pairId, saldi
      Cash −(totale−monete)/Monete 0), edit importo (pair preservato, cashflow sostituiti),
      rimuovi monete (gruppo via, spesa semplice), aggiungi monete (gruppo creato),
      validazione importo>totale (toast ⚠️); build OK
- [x] **Main view / navigazione**: `handleMovementClick` in `MainView.tsx` ora riceve l'intero
      movimento; se un cashflow routing ha `routingPairId` e nella lista esiste una spesa con
      lo stesso `routingPairId` (spesa con monete) apre la modifica della **spesa**, altrimenti
      resta la modifica entrata (routing normale). Nessun dato extra caricato (usa la stessa
      `movements` già renderizzata). Verificato nel browser: click riga gialla di coin split →
      "Modifica spesa" con monete pre-caricate; click routing normale → "Modifica entrata";
      build OK
- [x] **Analytics (opzione A) — fix trovata e applicata**: `loadMovements` ora mantiene
      **tutti** i movimenti del periodo nel context (non nasconde più i cashflow interni);
      il nascondimento (controparti negative + entrate interne di coin split) è diventato
      un filtro di **visualizzazione** di ogni view: `MainView` usa `routingCounterpartIds`,
      `AnalyticsPage` usa lo stesso filtro per la lista report e il CSV (`reportMovements`)
      mentre i **totali** usano `isRoutingCashflow` → l'entrata interna CONTA in Total
      Cashflow (opzione A, Net coerente coi saldi) e i leg di routing restano esclusi.
      Verificato nel browser: Totale Entrate +100.50 (100 reale + 0.50 interna), Saldo 70.00
      (= somma saldi conti), lista report senza entrata interna, Main view ancora 2 righe;
      build OK
- [x] **Backup/Ripristino**: la normalizzazione di `routingPairId` (Expense e Cashflow) in
      `src/utils/backup.ts` era già stata aggiunta nello step 1; verificato il **round-trip**
      completo nel browser: export (JSON contiene `routingPairId`) → `readBackupFile` +
      `importAllData` → dopo l'import spesa e gruppo coin-split intatti (pair id preservato,
      3 cashflow −/+/+), routing normale preservato, Main view mostra di nuovo 2 righe per
      la spesa con monete; build OK
- [x] **Test end-to-end**: verificati in browser tutti i percorsi tramite UI: crea conto
      Monete, crea spesa con monete (Main view 2 righe, saldi Cash −(totale−monete)/Monete 0,
      Analytics opzione A: Entrate +0.50, Saldo −10.00 = somma saldi), CSV export senza
      errori, edit/rimuovi/aggiungi monete, delete spesa (gruppo via), delete cascata conto
      monete (cashflow via + spesa scollegata); backup round-trip (gruppo preservato);
      build finale OK

## ⏳ Da fare

> **Nuove funzionalità richieste il 04/09/2026**. Note/Luogo + GPS: **completata** (05/09/2026).
> Resta da implementare la **Main view per giorno** (design righe aggiornato il 05/09/2026
> dopo il wireframe `mainview-list.svg`: righe senza data/ora, raggruppamento per giorno in
> tutti i filtri). Le specifiche sono in `spec.md` ("Movement list grouped by day", UI
> redesign → Main view). Gli step andranno marcati [x] man mano.

### Note e Luogo sulle spese (campi facoltativi) + Luogo da GPS — completata il 05/09/2026
- [x] **DB + types**: campi `notes: string` (default '') e `location: string` (default '') su
      `Expense`; normalizzati in lettura in `src/db/database.ts` (`normalizeExpense`) e in
      import in `src/utils/backup.ts` (niente bump `DB_VERSION`)
- [x] **CreateExpensePage**: campo "Note" (testo libero facoltativo) e campo "Luogo" (testo
      libero facoltativo), pre-caricati in edit, salvati sul record spesa; non influenzano
      Analytics né i saldi conto
- [x] **Luogo da GPS**: bottone accanto al campo Luogo →
      `navigator.geolocation.getCurrentPosition` → reverse geocoding **Nominatim** (online) →
      nome luogo come default nel campo (modificabile). Gestire permesso negato/errore GPS/
      offline con Toast ⚠️ (campo lasciato manuale, mai bloccare il salvataggio); nota
      secure context (Geolocation richiede HTTPS o localhost, non funziona su HTTP su IP di
      rete)
- [x] **Test E2E** nel browser (crea spesa con note/luogo; edit pre-caricato; bottone GPS con
      e senza rete/permessi; build OK)

### Main view — lista per giorno con righe dettaglio (niente data/ora) — completata il 05/09/2026
> Design definito il 05/09/2026 dopo il wireframe `docs/wireframes/mainview-list.svg`
> (righe senza ora) e le decisioni utente: raggruppamento per giorno in **tutti** i filtri
> e righe che mostrano **solo i dettagli** (mai data/ora).
- [x] **Raggruppamento per giorno in tutti i filtri**: la lista Main view è raggruppata per
      giorno per OGNI intervallo (`current-month`, `previous-month`, `current-year`, `all`);
      gruppi dal più recente, dentro ogni giorno movimenti per data+ora desc
- [x] **Righe senza data/ora**: le righe movimento mostrano solo i dettagli (mai data né ora;
      l'ora conta solo per l'ordinamento). Helper di formattazione: abbreviazioni settimana
      italiane (lun/mar/mer/gio/ven/sab/dom) e nomi mese per l'header esteso
- [x] **Dettaglio righe** (da `docs/wireframes/mainview-list.svg`): Spesa = categoria + conto
      (es. "💸 Dinner · Cash") e, se il luogo è compilato, seconda riga col luogo (es.
      "📍 Via Roma 1, Milano"); Entrata = conto; routing = sorgente → destinazione
- [x] **Header giorno**: nei filtri a mese singolo formato compatto "4 ven" (+ oggi
      "· Oggi"); in Quest'anno/Tutti header con il mese per esteso (es. "Settembre 5 Sab") e
      con l'anno quando l'intervallo copre più anni (Tutti)
- [x] **Ordinamento e paginazione**: il paginatore a scroll non deve MAI tagliare un gruppo
      giorno (se il confine di pagina cade a metà giorno, il giorno intero compare nella
      pagina successiva); auto-load dei gruppi quando il contenuto non riempie il viewport
- [x] **CSS**: stile header giorno (separatore), evidenziazione oggi, riga spesa con eventuale
      seconda riga luogo
- [x] **Test E2E** nel browser (switch filtri, header oggi, header con mese/anno in Quest'anno/
      Tutti, righe spesa con conto e luogo, gruppo giorno mai tagliato; build OK)

*(Nota storica: il task Backup/Ripristino (Export/Import JSON) è stato implementato e
verificato il 23/08/2026 — vedi sezione ✅ Completati.)*

## 🐛 Bug da correggere

*(Tutti i bug elencati sono stati corretti il 16/08/2026 — vedi sezione ✅ Completati.)*

## 👀 Osservazioni (limiti noti, da tenere d'occhio)

- **Main view al primo load freddo**: il filtro "This month" può apparire vuoto subito dopo il caricamento della pagina (transitorio, legato a IndexedDB); cliccando un filtro i dati compaiono.
- **Pagine Analytics/Categories/Accounts**: non caricano i `movements` da sole, dipendono dalla Main view. Con navigazione diretta (reload su `/analytics`) i totali risultano vuoti → valutare un `loadMovements` nel mount di queste pagine.

## 🔮 Prossime release
- [ ] **Create from photo**: fotocamera smartphone + lettura dello scontrino con AI per creare la spesa automaticamente
- [ ] **Gestione multi-valuta**
