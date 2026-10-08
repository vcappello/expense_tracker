i# Plan — Expense Tracker AI

> Piano di attività per lo sviluppo della webapp.
> Regole: gli step completati vengono **marcati come completati ma mai cancellati**.
> Ogni nuova feature o correzione di bug va aggiunta qui.
> Sezioni: **✅ Completati** (riepilogo + 🗂️ dettaglio degli step) · **⏳ Da fare** ·
> **🐛 Bug da correggere** · **👀 Osservazioni** (limiti noti) · **🔮 Prossime release**.
> ⚠️ **Pubblicazione**: `npm run build` → commit locale → **chiedere conferma all'utente** →
> `git push` (il push pubblica subito su GitHub Pages, vedi `AGENTS.md`).

## ✅ Completati

### Riepilogo funzionalità e correzioni

- [x] **Setup progetto**: React + TypeScript + Vite, struttura a componenti e routing
- [x] **Database locale (IndexedDB)**: store per `Account`, `ExpenseType`, `Expense`, `Cashflow`
- [x] **Dati iniziali**: Account (Cash, Bank account, Coins — stash non tracciato preferito), ExpenseType (Dinner, Shopping, Fuel, Tolls). Il conto **Coins** viene creato anche sui database già esistenti privi di stash (backfill idempotente all'avvio, salta se esiste già uno stash o un conto chiamato "Coins")
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
- [x] **Giacenza iniziale conti (`initialBalance`)**: nuovo campo `initialBalance` sull'`Account` (default 0, normalizzato in lettura per i conti esistenti); campo **"Giacenza iniziale (€)"** in creazione/modifica conto; nella **gestione Conti** mostrato il **saldo corrente** (`initialBalance + cashflows − expenses + rettifiche` sui conti normali; i movimenti sugli stash non modificano il loro saldo), abbreviato e colorato per segno; Analytics invariati (la giacenza non è un movimento, nessuno skew al primo mese); `spec.md` aggiornata
- [x] **Rettifiche di saldo unificate per conto**: `AccountBalanceAdjustment` datate per conti Cash e bancari; saldo osservato con anteprima differenza, storico modificabile/eliminabile e cancellazione in cascata; saldi conto e Andamento aggiornati dalla data, senza impatto su entrate/spese, report o CSV; database e backup v3 retrocompatibili con backup v1/v2; spec, README e AGENTS aggiornati.
- [x] **Conto preferito (`isPreferred`)**: nuovo flag `isPreferred` sull'`Account` (default false, normalizzato in lettura); checkbox in creazione/modifica conto; i conti preferiti vengono mostrati per primi e marcati con ★. In Spesa, il preferito normale diventa il principale default e il preferito stash il secondario default; `spec.md` aggiornata
- [x] **Fix navigazione dopo save/delete (Back button)**: dopo aver salvato o eliminato da una view create/edit la navigazione usava `navigate('/...')` (push) che inquinava lo stack del browser e rompeva il Back (es. main → conti → crea conto → salva → al secondo Back si tornava alla form invece che a main). Ora save/delete usano `navigate(-1)` per tornare alla view di origine preservando lo stack; nuovo helper `src/utils/navigation.ts` (`useNavigateBack`) con fallback alla route canonica quando non c'è storia precedente (reload/accesso diretto). Applicato a create/edit di Account, ExpenseType, Expense e Cashflow. Verificato nel browser: main → conti → crea conto → salva → Back → main; main → categorie → crea categoria → salva → Back → main; `spec.md` aggiornata
- [x] **Sostituite le modali native con modali custom (componenti shared)**: eliminati `window.confirm` (delete Spesa/Entrata) e tutte le `alert()` (validazione/errori) dai 4 form create/edit. Nuovo componente base **`Modal`** (`src/components/Modal.tsx` + `src/styles/Modal.css`: overlay + titolo + contenuto + azioni, chiusura su backdrop/ESC, `aria-modal`); **`ConfirmModal`** ora è un wrapper sopra `Modal` (2 bottoni) usato per delete di Account, ExpenseType, **Spesa ed Entrata**; nuovo **`AlertModal`** (1 bottone OK) per gli errori (salvataggio/caricamento/eliminazione); le validazioni campi obbligatori usano il **`Toast`** (nuova prop `icon`, ⚠️ per i warning); eliminato `ConfirmModal.css` (stili spostati in `Modal.css`); `spec.md` aggiornata
- [x] **Importo con tastiera numerica su smartphone**: aggiunto `inputMode="decimal"` al campo **Importo (€)** dei form Spesa (`CreateExpensePage`) ed Entrata (`CreateCashflowPage`), come nel campo "Giacenza iniziale (€)" dei conti — su smartphone si apre la tastiera numerica
- [x] **Backup/Ripristino database (Export/Import JSON)**: nuove voci "Esporta backup" / "Ripristina backup" nel menu Azioni della Main view. **Export**: scarica un file JSON (`expense-tracker-backup-YYYY-MM-DD.json`) con tutti e 4 gli store (Account, ExpenseType, Expense, Cashflow), date ISO, indipendente dall'origine. **Import**: selezione file → `ConfirmModal` di avviso ("sostituirà tutti i dati") con conteggi → sostituzione **atomica** (clear + insert nella stessa transazione IndexedDB, `db.importAllData`) → reload dello stato (conti, categorie, spese, entrate, movimenti) via `restoreBackup` in `AppContext`; file non validi → `AlertModal`; successo → `Toast`. Nuovo `src/utils/backup.ts` (`exportDatabase`, `readBackupFile` con normalizzazione di `initialBalance`/`isPreferred`/`parentId`/`routingAccountId` e riconversione date ISO → `Date`). Necessario perché IndexedDB è legato all'origine: al passaggio a HTTPS i dati non vengono ereditati. Verificato in browser (:5173, round-trip con gerarchia categorie, routing, conto preferito e giacenza; file invalido rifiutato senza toccare i dati). `spec.md` aggiornata

- [x] **Spesa pagata in parte da un conto secondario non tracciato**: registra la spesa
      TOTALE vera facendo scalare al conto principale solo la parte non coperta dal secondario
      (il cui saldo resta invariato). Implementazione:
      campo `routingPairId` su `Expense`/`Cashflow` con **link esplicito** (fallback
      euristico per dati legacy, niente bump `DB_VERSION`); `routing.ts` basato sul link;
      operazioni atomiche del gruppo (`createExpenseGroup`/`updateExpenseGroup`/
      `deleteExpenseGroup`); `saveExpenseWithCoins` in AppContext + `buildCoinSplitCashflows`
      (`src/utils/coins.ts`); campi per importo e conto secondario nel form spesa (preview,
      validazioni); click riga gialla → modifica spesa; **Analytics opzione A** (l'entrata
      interna conta: `movements` del context = TUTTI i movimenti, filtraggio display per-view
      in MainView/Analytics, mai in `loadMovements`); delete a cascata conti/categorie senza
      leg orfani; backup normalizzato. Verificato E2E nel browser. Spec in `spec.md`
      (sezione "Expense paid partly from an untracked secondary account"), regole in
      `AGENTS.md`.

- [x] **Stash secondario non tracciato (`isCoinAccount`)**: flag su `Account` (default false,
      normalizzato in lettura/import) per abilitare un conto come fonte secondaria non
      tracciata; nel form spesa il dropdown "Conto secondario" elenca **solo** i conti abilitati,
      con hint quando non ce ne sono e opzione di ripiego per selezioni legacy. Verificato E2E
      nel browser. Spec in `spec.md`, attività in `AGENTS.md`.
- [x] **Tipo conto stash non tracciato e default per tipo**: sostituiti i riferimenti UI alle
      monete con "Tipo di conto" (Conto normale / Stash secondario non tracciato) e "Pagata in
      parte da un conto secondario"; ogni conto resta selezionabile come principale, gli stash
      sono anche nel selettore secondario. Uno stash non modifica il saldo con spese/entrate,
      anche se è il conto principale; Analytics conserva l'intero importo. `isPreferred`
      indipendente ma contestuale nel form Spesa (normale = default principale, stash =
      default secondario); il default principale di Spesa/Entrata/Ricorrenze è sempre il primo
      conto **normale** preferito (`getDefaultPrimaryAccount` in `src/utils/accounts.ts`), mai
      uno stash. Badge generico "2°"; dati `isCoinAccount` conservati senza bump DB.
      Spec, plan, README e AGENTS aggiornati.
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
- [x] **Main view — indicatore dell'intervallo nel pulsante Filtri**: il pulsante Filtri
      della action bar mostra accanto all'imbuto l'**intervallo attivo** come testo: per i
      filtri a mese singolo "Mese + anno" (es. "Settembre 2026", "Agosto 2026" — l'anno
      evita ambiguità per "Mese scorso" a cavallo d'anno), per "Quest'anno" solo l'anno
      ("2026"), per "Tutti" la scritta "Tutti". Pulsante unico pill (imbuto + etichetta,
      classe `.filter-menu`/`.filter-value`) che apre il menu; helper `formatMonthYear` in
      `formatting.ts`. Così il periodo mostrato è sempre chiaro anche senza data/ora sulle
      righe. Verificato in browser (i 4 intervalli aggiornano l'etichetta).
- [x] **Fix deprecazione TS `moduleResolution=node10`**: rimosso il warning di compilazione
      "moduleResolution=node10 is deprecated... TypeScript 7.0" passando
      `"moduleResolution": "Bundler"` in `tsconfig.app.json` e `tsconfig.node.json`
      (prima era "Node" = legacy node10). Verificato: `npm run build` e `tsc -b` senza
      warning, nessuna regressione.
- [x] **Main view — riga movimento: importo sempre visibile (fix layout con Luogo lungo)**
      (06/09/2026): bug segnalato dall'utente — con un luogo lungo (es. da GPS/Nominatim)
      l'importo finiva fuori schermo a destra su smartphone. Causa: **collisione di classi
      CSS globali** (i CSS delle pagine sono importati staticamente, quindi tutti sempre
      attivi): `.movements-list` (`display:grid; gap:8px`) e `.movement-type` di
      `AnalyticsPage.css` sovrascrivevano le classi omonime della Main view → la lista per
      giorno diventava una griglia la cui colonna auto si allargava al contenuto più lungo
      (luogo, 841px nel test) spingendo l'importo oltre il bordo (overflow orizzontale).
      Fix: classi del report Analytics rinominate in `report-movements-list` /
      `report-movement-type`; `.movements-list` della Main view con `display: block`
      esplicito. Layout riga: `.movement-content` ora è una **griglia a 2 colonne
      `minmax(0, 1fr) auto`** — sinistra (dettagli) si comprime sempre e il testo va a capo
      facendo crescere l'altezza della riga (il luogo usa `overflow-wrap: anywhere`,
      poi rifinito a max 2 righe con ellissi — vedi bullet successivo); destra =
      **importo fisso, `white-space: nowrap`, sempre visibile**, font ingrandito e più
      bold (`1.25rem` / `1.15rem` mobile, weight 700, `min-width: 96/88px`). Verificato
      nel browser a larghezza smartphone (390px e meno): luogo lunghissimo (anche senza
      spazi) va a capo in più righe, importo sempre a destra e visibile, nessun overflow
      orizzontale; report Analytics invariato. Spec in `spec.md` (sezione Main view/UI).
- [x] **Main view — rifiniture riga movimento** (06/09/2026, dopo la fix importo sempre
      visibile): (1) il **luogo è limitato a max 2 righe con ellissi** (`line-clamp` /
      `-webkit-line-clamp` + `overflow-wrap: anywhere`); il testo completo resta nella
      view di modifica; (2) l'importo è **allineato alla prima riga di testo** della riga
      (`align-items: baseline` sulla griglia di `.movement-content`, non più centrato
      rispetto all'intero blocco dettagli); (3) **area di tocco più ampia** su smartphone:
      padding verticale della riga aumentato (14px desktop / 12px mobile). Verificato nel
      browser a larghezza smartphone: luogo lunghissimo → 2 righe + ellissi, importo sulla
      riga del tipo sempre visibile a destra, riga più alta e facile da toccare; build OK.
- [x] **Spese da rimborsare + riepilogo nello stipendio (`reimbursable` / `isSalary`)**
      (06/09/2026): nuovo flag `Expense.reimbursable` (default false; checkbox "Sarà
      rimborsata" nel form spesa, crea+edit, anche sul record principale delle spese con
      monete) e `Cashflow.isSalary` (default false; checkbox "Stipendio" nel form entrata);
      normalizzati in lettura in `database.ts` (`normalizeExpense` / `normalizeCashflow`) e
      in import in `backup.ts` (niente bump `DB_VERSION`). Logica **"solo finestra di
      tempo"** in `src/utils/reimbursements.ts` (`findPreviousSalary` /
      `getReimbursableSummary`) + metodo `getReimbursableSummary` nel context: nel form
      entrata, con "Stipendio" attivo, un pannello mostra "💶 Spese da rimborsare
      dall'ultimo stipendio: TOTALE€ (n)" — totale delle spese `reimbursable` con data
      successiva all'ultimo stipendio precedente registrato (nessuno → tutte). Le spese
      rimborsabili **restano spese normali** in Analytics/saldi. In Main view le righe con
      `reimbursable` mostrano un badge "da rimborsare" (rifinitura 06/09/2026 — vedi
      bullet sotto). Verificato E2E nel browser (finestra corretta con 2 stipendi e spese
      prima/dopo lo stipendio: 37.50€/2 escludendo spese precedenti e non rimborsabili;
      salvataggio stipendio `isSalary` e spesa `reimbursable`; prefill in modifica;
      round-trip backup); build OK. Spec in `spec.md` (sezione "Expenses to be reimbursed
      (reimbursable) and Salary").
- [x] **Main view — badge "da rimborsare" sulle spese rimborsabili** (06/09/2026): nelle
      righe della lista movimenti le spese con `reimbursable` mostrano una piccola pill
      testuale "da rimborsare" accanto alla descrizione (decisione utente: TUTTE le
      marcate "Sarà rimborsata", indipendentemente dagli stipendi registrati; nessuna
      modifica al modello). La riga resta invariata per le altre spese (badge assente);
      importo e colori invariati. Verificato nel browser (badge solo sulla spesa
      rimborsabile, importo sempre visibile, nessun overflow orizzontale); build OK.
- [x] **Spese ricorrenti (recurring expenses)** (12/09/2026): nuovo store
      `recurringExpenses` (**primo bump `DB_VERSION` 1 → 2**, upgrade che crea solo lo
      store mancante con gestione `onblocked`) e modello `RecurringExpense`
      (nome, frequenza giornaliera/settimanale/mensile/annuale, importo di default,
      categoria, conto, `startDate`, `active`, note/luogo/rimborsabile, stato periodo).
      L'occorrenza **prevista** non è un record: è derivata dal template
      (`src/utils/recurrence.ts`: chiave periodo `2026-09-12`/`2026-W37`/`2026-09`/`2026`,
      scadenza del periodo con settimana lun–dom, mensile 31 → ultimo giorno, annuale
      29/02 → 28/02, prossima scadenza) più `lastConfirmedPeriod`/`skippedPeriod`;
      **una sola prevista per periodo**, le mancate si saltano. Conferma → **Expense
      normale** con `recurringId`/`recurringPeriod` (idempotente) + toast **Annulla**
      (anche per "Conferma tutte": il context salva gli id creati in blocco); importo
      modificato → modale a 3 pulsanti "Solo questa / Tutte le successive"; Elimina →
      modale "Salta questa / Interrompi la ricorrenza"; cancellare una spesa confermata
      **ripropone** la prevista. Nuove pagine `/recurring` (gestione con badge frequenza,
      pausa, prossima scadenza), `/recurring/new|:id/edit` e `/recurring/:id/confirm`;
      voce **"🔁 Ricorrenti"** nel menu Azioni. Main view: sezione **"Spese previste"**
      (header dedicato) subito dopo il gruppo di oggi e fuori dalla paginazione, solo nei
      filtri che contengono oggi, con **badge frequenza** (🔁 Giornaliera/Settimanale/
      Mensile/Annuale) e importo previsto in grigio; le spese già confermate restano righe
      normali (nessun badge). Analytics: previste **nei totali** sotto la pseudo-categoria
      **"Spese previste"** (griglia grigia, top categorie, report, CSV "Spesa prevista",
      grafici) ma **nessun effetto sui saldi conti**; contano sul mese della **scadenza**,
      seguono il filtro Conto e ignorano il filtro Categoria. Cascade Conto/Categoria
      estese ai template (conteggio "N spese ricorrenti" nei popup). **Backup v2**
      (`recurringExpenses`, import retrocompatibile con i file v1). Verificato E2E in
      browser: creazione/conferma (solo questa, tutte le successive), undo singolo e
      multiplo, salta/interrompi, delete spesa confermata, cascade, periodi (settimanale
      lun–dom, mensile 31, annuale 29/02, non ancora scadute, in pausa, saltate),
      Analytics + saldi conti invariati, CSV, grafici e round-trip backup v2/v1; build OK.
- [x] **Fix limite noto — Analytics/Conti/Categorie caricano i movimenti da sole**
      (12/09/2026): queste pagine non dipendono più dai `movements` caricati dalla Main
      view (limitati al filtro periodo scelto lì). Con reload diretto su `#/analytics`
      (o aprendo Conti/Categorie per prime) i totali erano vuoti e, cambiando periodo in
      Analytics, potevano essere calcolati su dati scoped al filtro della Main view. Ora
      `AnalyticsPage`, `AccountManagementPage` e `ExpenseTypeManagementPage` chiamano
      `loadMovements({ dateRange: 'all' })` nel loro mount: il dataset è completo e ogni
      pagina applica il **proprio** filtro (Analytics e Categorie per data; Conti per
      saldo e "ultimo movimento"). Main view invariata (ricarica col proprio filtro al
      mount). Verificato in browser con reload diretto sulle tre pagine (dati 2025 +
      2026) e con Back da Analytics → Main view; build OK. Bonus: "Ultimo movimento" in
      Gestione Conti ora ordina per **data + ora** (`toDateTime`), non solo per data.
- [x] **Fix "Main view al primo load freddo"** (19/09/2026): risolto il limite noto per cui
      la lista poteva apparire vuota ("Nessun movimento") subito dopo il caricamento della
      pagina, con i dati che comparivano solo toccando un filtro. Cause individuate
      riproducendo il bug in modo deterministico (CPU throttling 20x + `MutationObserver`
      sulle classi `.empty-state`/`.loading-state`: sequenza `EMPTY → LOADING → EMPTY →
      GROUPS`): (1) `isLoading` era un **unico booleano** condiviso da tutti i `load*` del
      context → il primo caricamento che finiva (conti, categorie, ricorrenze) lo riportava
      a false mentre i movimenti erano ancora in lettura; (2) al **primo paint** `isLoading`
      è false e `movements` vuoto → l'empty state compariva prima che il caricamento
      partisse. Fix in `AppContext`: `isLoading` ora deriva da un **contatore**
      `pendingLoads` (`beginLoad`/`endLoad`: resta true finché tutti i caricamenti non sono
      conclusi) e nuovo flag **`movementsLoaded`** (false finché il primo `loadMovements`
      non è concluso), usato da `MainView` e `AnalyticsPage` per mostrare lo spinner invece
      del falso empty state. Dopo il fix la sequenza è solo `LOADING → GROUPS`. Verificato
      cold load ripetuti (con e senza CPU throttling), tutte le view (main, analytics,
      conti, categorie, ricorrenze), cambio filtro verso un periodo senza movimenti
      (empty state regolare) e nessun errore in console; build OK.
- [x] **Entrate programmate / ricorrenti (stipendio, una tantum)** (19/09/2026): le
      **Ricorrenze** ora coprono anche le **entrate**, con **un'unica entità**
      (`RecurringExpense.kind: 'expense' | 'income'`, default `expense`, normalizzato in
      lettura/import → nessun bump `DB_VERSION`, backup v2 e file vecchi validi) e la nuova
      frequenza **`once`** ("Una sola volta") per l'**entrata pianificata una tantum**.
      La conferma crea un **`Cashflow`** (con `recurringId`/`recurringPeriod`, campi aggiunti a
      `Cashflow`; `isSalary` copiato dal template) invece di un `Expense`; **eliminare il
      cashflow confermato ripropone la prevista**; l'undo in blocco gestisce entrambi i tipi;
      i cascade e il delete del template scollegano anche i cashflow generati. Form Ricorrenze
      con **switch Tipo Spesa/Entrata** (campi condizionali, \"Stipendio\"), Main view con la
      sezione unica **\"Movimenti previsti\"** (spese grigie `-`, entrate verdi `+`,
      \"Conferma tutte\" misto), Analytics con le entrate previste in **Totale Entrate/Saldo**
      sotto il pseudo-bucket **\"Entrate previste\"** (report, lista, CSV \"Entrata prevista\",
      grafici) e **mai** nei saldi conto né nel grafico Andamento; pannello \"💶 Spese da
      rimborsare dall'ultimo stipendio\" nel form di conferma degli stipendi. Verificato E2E in
      browser (creazione da UI, conferma, undo, delete → prevista che ritorna, `once` senza
      modale sull'importo, \"Conferma tutte\" mista, backup round-trip e file v2 legacy);
      build OK. Voci in ⏳ Da fare e spec in `spec.md` (\"Recurring / scheduled income\").
- [x] **Grafico "Andamento del saldo" a linee in Analytics** (19/09/2026): terza vista dello
      switch di Analisi (`📋 Report` / `📊 Grafico` / `📈 Andamento`) con un grafico a linee
      (nuovo `src/components/BalanceTrendChart.tsx`, SVG senza dipendenze) che mostra
      l'**andamento del saldo**: asse X = giorni del periodo, asse Y = saldo cumulativo a fine
      giornata. Il saldo di partenza è **reale** (`initialBalance` dei conti in scope + tutti i
      movimenti precedenti al periodo, formula di Gestione Conti
      `initialBalance + cashflows − expenses`), quindi **l'ultimo punto coincide con il saldo
      dei conti**; i delta giornalieri sono raggruppati in una `Map` e l'asse è limitato al
      periodo effettivo (`max(inizio, primo movimento)` → `min(fine, oggi)`) per non generare
      migliaia di punti su "Tutto il periodo" (range grezzo 1970–2099). Filtri applicati al
      saldo (Conto = conti in scope; Categoria = solo le spese di quelle categorie, i cashflow
      non hanno categoria); **spese previste escluse**. Tooltip (data, saldo, variazione
      giornaliera) via pointer events sull'intero SVG, con aggancio ai bordi per non uscire
      dallo schermo; punti visibili solo per periodi ≤ 31 giorni; linea tratteggiata sullo
      zero. Su smartphone le etichette dell'asse X indicano il lunedì di inizio settimana,
      con riduzione automatica dei label nei periodi lunghi. Verificato E2E in browser
      (mese corrente/mese scorso/anno/tutto, filtro conto
      singolo con saldi esatti −45.50€/1.64K€ coerenti con Gestione Conti, filtro categoria,
      empty state, nessun overflow a 390px, report e grafici esistenti invariati); build OK.
      `spec.md` aggiornata (sezione "Andamento (balance trend)").
      **Rifinitura (19/09/2026)**: i tre pulsanti toggle nella title bar (su smartphone
      occupavano tutta la barra, comprimendo il titolo a 1px e coprendo il Back) sono stati
      sostituiti da un **menu a pill "Vista"** che mostra la vista attiva e apre la lista con
      il ✓ (stesse classi `.filter-menu`/`.filter-value` del pulsante Filtri della Main view),
      passato alla `TitleBar` tramite il nuovo slot `extraActions`; rimosso il kind `toggle`
      ormai inutilizzato. Verificato a 390px e 320px (titolo e Back sempre visibili, menu
      dentro il viewport) e a 1200px.
- [x] **Saldo previsto nel grafico Andamento** (26/09/2026): la linea continua blu mostra il
      saldo reale fino a oggi; la linea tratteggiata viola proietta il saldo fino alla fine
      del periodo selezionato (massimo 12 mesi per "Tutto il periodo"), includendo
      ricorrenze future e movimenti reali con data futura. Marker rossi/verdi e tooltip
      distinguono spese ed entrate previste. Filtri di conto/categoria rispettati;
      ricorrenze in pausa, confermate o saltate escluse. Motore in
      `src/utils/balanceTrend.ts`; specifica e README aggiornati; `npm run build` OK.
- [x] **Icona aggiornata ma non visibile da browser/smartphone (cache SW)** (04/10/2026):
      le icone rigenerate mantenevano lo stesso URL e il service worker (cache-first su
      `/icons/`) continuava a servire quelle vecchie. Fix: URL versionati (`?v=2`) in
      `index.html` e nel manifest, `ICON_VERSION` in `public/sw.js`, precache delle icone
      all'install e cache SW bumpata a `expense-tracker-v3`. Dettagli in "⏳ Da fare" e in
      `AGENTS.md`.
- [x] **Inserimento spese più rapido: autofocus sull'importo + "Mostra dettagli"** (04/10/2026):
      in creazione il campo Importo è già a fuoco (tastierino numerico pronto) e i campi
      opzionali (data, ora, da rimborsare, note, conto secondario) stanno in una sezione
      richiudibile, chiusa in creazione e aperta in modifica, con una riga di riepilogo quando
      contiene valori non predefiniti. Durante il test è emerso e stato corretto anche il
      **bug della virgola decimale** scartata in silenzio (`12,50` → `1250`): nuovi
      `AMOUNT_INPUT_PATTERN`/`parseAmountInput` in `src/utils/formatting.ts`, applicati a
      **tutti** i form importo (Spesa, Entrata, Ricorrenze, conferma prevista, giacenza conto).
- [x] **Creare una spesa da una esistente: chip "Ripeti una spesa recente" + "Duplica"**
      (04/10/2026): nel form di creazione una riga di chip riempie luogo, categoria, conto, note
      e "sarà rimborsata" dall'ultima spesa (o da quella scelta), lasciando l'importo vuoto e a
      fuoco; nella view di modifica l'azione "Duplica" apre lo stesso form precompilato
      (`/expense/new?from=<id>`). Nel test è emerso e stato corretto anche il **riuso
      dell'istanza di pagina** tra modifica e creazione (key distinte nelle route in `App.tsx`).
- [x] **Importi con la virgola (formattazione italiana)** (04/10/2026): gli importi erano
      renderizzati con `toFixed(2)`, quindi col **punto** (`Saldo: -12.50€`) mentre l'input
      accettava la virgola. Ora `abbreviateAmount` e il nuovo `formatAmount` usano un
      `Intl.NumberFormat('it-IT')` condiviso: virgola decimale e raggruppamento italiano
      (`1.234,56`). Sostituiti anche i `toFixed(2)` residui nei tooltip SVG
      (`MovementsChart`, `MonthBreakdownChart`) e nei popup di eliminazione di conto/categoria.
      Uniformata anche la **stampa del simbolo**: `formatCurrency` non usa più lo stile
      `currency` di `Intl` (che stampava `12,50 €` con lo spazio) ma compone importo + simbolo
      → `12,50€`, come in tutto il resto dell'app.
- [x] **Chip "Ripeti una spesa recente" senza allargare la view** (08/10/2026): `min-width: 0` su `.quick-fill`/`.quick-fill-chips` (e sul singolo chip) → la riga chip resta larga quanto lo schermo e scorre solo lei, non più tutta la view (dettaglio sotto)
- [x] **Ricorrenze — azione "Registra ora"** (08/10/2026): registrare un movimento ricorrente **in anticipo** (prima della scadenza) dall'elenco Ricorrenti; consuma il periodo della scadenza, così non viene riproposto (dettaglio sotto)

### Rifiniture UX: chip "Ripeti una spesa" e registrazione in anticipo delle ricorrenze — implementate l'08/10/2026

> Richieste utente (08/10/2026): (1) nella creazione spesa la riga di chip "Ripeti una spesa
> recente" allargava tutta la view su smartphone; (2) non era possibile registrare una spesa
> ricorrente pagata **in anticipo**, perché la prevista compare solo dalla scadenza.

- [x] **Chip "Ripeti una spesa recente": larghezza fissa + scroll orizzontale** (fatto):
      causa = la riga chip è un grid item di `.expense-form` e con `min-width: auto` la sua
      min-content (luoghi lunghi, `nowrap`) allargava la riga fino a ~960px su 390px,
      trascinando tutta la view in orizzontale. Fix in `ExpenseForm.css`: `min-width: 0` su
      `.quick-fill` e `.quick-fill-chips`, `min-width: 0` + `max-width: 60vw` sul chip.
      Verificato nel browser a 390px (`chipsClientWidth` 960 → 366, `scrollWidth` 960) e
      confermato che è il fix a risolvere (rimuovendolo la riga torna 960px).
- [x] **Ricorrenze — azione "Registra ora"** (fatto): nuova `getNextOccurrence(template,
      today)` in `utils/recurrence.ts` (occorrenza del periodo corrente ancora futura e non
      consumata) e azione nell'elenco Ricorrenti → `/recurring/:id/confirm?early=1` con banner
      "⏱️ Registrazione in anticipo". `ConfirmRecurringInput` e `skipRecurringOccurrence`
      accettano un `periodKey` esplicito per consumare il periodo della **scadenza** (non
      quello del giorno di conferma): così la prevista non ricompare alla scadenza. La
      conferma anticipata resta limitata al periodo corrente (nessuna registrazione con un
      mese/anno di anticipo). Il pulsante è **icon-only (✓) e sempre a destra sulla stessa
      riga**: l'override `.list-item.recurring-item` mantiene la riga orizzontale anche su
      mobile (≤640px), dove `.list-item` passa a colonna → prima il pulsante finiva su una
      seconda riga e la ricorrenza diventava alta il doppio (172px → 118px a 390px).
      Verificato nel browser: ricorrenza mensile al 25 registrata l'08
      (`recurringPeriod = 2026-10`, bottone nascosto dopo la conferma), riga compatta con
      pulsante 40×40 centrato a destra (misure a 390px e 900px, nessun overflow), ricorrenza
      dovuta oggi senza bottone (proposta nei movimenti previsti), dati di test poi rimossi;
      build OK.

## �️ Dettaglio dei lavori a più step (tutti completati)

> Cronologia degli **step di lavoro** delle attività più complesse, conservata come
> riferimento (gli step completati non si cancellano mai).
> Ordine dei blocchi: prima le due attività di **agosto 2026** (conto monete, spesa pagata
> in parte con monete), poi quelle di **settembre 2026** dalla più recente (grafico
> "Andamento del saldo") alla più vecchia (Note/Luogo, Main view per giorno).
> (La precedente sezione "🔄 In corso / Prossimi" è **chiusa**: le sue due attività sono
> completate e i relativi step sono qui sotto.)

### Conto monete (flag isCoinAccount) — completata il 24/08/2026

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

### Generalizzazione UI conto secondario non tracciato — completata il 03/10/2026

- [x] **Spec e compatibilità**: definite le etichette e il comportamento di stash non
      tracciato; conservato `isCoinAccount` e i dati esistenti senza migrazione IndexedDB.
- [x] **Tipo conto e descrizioni**: dropdown "Tipo di conto" con conto normale e stash
      secondario non tracciato; Conto preferito rimane indipendente; aiuto UI esplicita che
      movimenti assegnati allo stash non modificano il saldo.
- [x] **Form Spesa e indicatori**: aggiornati sezione, importo, selettore, hint, messaggi di
      validazione e anteprima; tutti i conti restano disponibili come principali, gli stash
      sono anche secondari; default contestuale per tipo, badge generico al posto della moneta.
- [x] **Verifica e documentazione**: build e controlli diff superati; schermate di modifica
      conto e creazione spesa verificate senza salvare dati di test; README e AGENTS aggiornati.

### Spesa pagata in parte con monete (secondo conto) — completata il 24/08/2026

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

### Grafico "Andamento del saldo" (a linee) — implementata il 19/09/2026

> Richiesta utente (19/09/2026): nell'Analisi il grafico "principale" deve essere a
> **linee**, con sull'asse X i **giorni del periodo** e sull'asse Y il **saldo del giorno**,
> per vedere l'andamento del saldo.
> Decisioni raccolte in pianificazione:
> - **saldo cumulativo progressivo** (non il netto del singolo giorno): la linea parte dal
>   saldo reale dei conti a inizio periodo e si aggiorna giorno per giorno;
> - **saldo di partenza reale** = `initialBalance` dei conti in scope + TUTTI i movimenti
>   precedenti al periodo (stessa formula di "Gestione Conti":
>   `initialBalance + cashflows − expenses`), così l'ultimo punto = saldo reale dei conti;
> - **terzo pulsante nello switch** `📋 Report` / `📊 Grafico` / `📈 Andamento`: i due grafici
>   attuali restano invariati;
> - **tutti i periodi**, asse X sempre a giorni; **filtri applicati al saldo** (Conto = conti
>   in scope con le loro giacenze; Categoria = solo le spese di quelle categorie);
> - **spese previste (ricorrenti) escluse** dalla linea: non muovono denaro, coerenza coi
>   saldi conto.

- [x] **Spec** (fatto il 19/09/2026): `spec.md` con la nuova sottosezione
      "Andamento (balance trend)" (periodo effettivo, saldo di apertura, filtri, esclusioni,
      rendering) e switch Analytics aggiornato a tre pulsanti.
- [x] **Nuovo componente `BalanceTrendChart`** (fatto): grafico a linee SVG (zero dipendenze,
      stile coerente con gli altri grafici: `.chart-section` e palette in `AnalyticsPage.css`,
      classi con prefisso `trend-*` per evitare collisioni). Linea unica + punto visibile per
      ogni giorno quando il periodo ha ≤ 31 giorni (per periodi più lunghi solo la linea),
      griglia orizzontale con 3 etichette Y *abbreviate*, linea tratteggiata sullo zero se il
      saldo cambia segno, etichette X diradate (~6 tick), tooltip HTML posizionato con
      `onPointerMove`/`onPointerDown` sull'intero SVG (funziona anche al tocco) con data,
      saldo e variazione giornaliera; il tooltip si aggancia ai bordi (`left`/`right`) per non
      uscire dallo schermo su smartphone.
- [x] **Calcolo dati in `AnalyticsPage`** (fatto): periodo effettivo
      `max(inizio range, primo movimento)` → `min(fine range, oggi)` (esteso all'ultimo giorno
      con movimento se è futuro e dentro il range); **saldo di apertura** = `initialBalance`
      dei conti in scope + movimenti precedenti all'inizio (usa `movements` completo, quindi
      anche controparti dei routing ed entrata interna del coin split, come Gestione Conti);
      delta giornalieri raggruppati in una `Map` (loop giorni O(giorni), non O(giorni×movimenti));
      un punto per ogni giorno del periodo (anche senza movimenti = tratto piatto); spese
      previste **escluse**; filtro Categoria applicato alle sole spese (i cashflow non hanno
      categoria); nessun movimento nel periodo → empty state.
- [x] **Switch a tre viste** (fatto): stato `view: 'report' | 'grafico' | 'andamento'` e terzo
      pulsante `📈 Andamento` nella `TitleBar` di Analytics; quando è attivo si mostra il
      nuovo componente (indipendente dal periodo, quindi né `MonthBreakdownChart` né
      `MovementsChart`); i due grafici esistenti invariati.
- [x] **Verifica E2E nel browser** (fatto, dev :5173, dati di test poi rimossi):
      "Questo mese" 19 punti (01/09→19/09, apertura 1470.00€, ultimo punto 1594.50€ =
      saldo totale in Gestione Conti, tooltip giorno per giorno corretti: 03/09 1.45K,
      05/09 1.65K, 10/09 1.63K, 18/09 1.59K); filtro Conto = Cash → apertura −30.00€ e
      ultimo saldo **−45.50€** = saldo Cash in Gestione Conti (valori esatti, la
      verifica incrociata con i saldi conto torna); "Mese scorso" 31 punti 01/08→31/08 con
      apertura 1.00K (bug trovato e corretto durante il test: l'asse si estendeva fino a
      settembre perché il clamp usava l'ultimo movimento *globale*, non quello del periodo);
      "Quest'anno" e "Tutto il periodo" 81 punti con inizio 01/07 (primo movimento, **non**
      1970); filtro Categoria = Dinner → ultimo saldo 1.63K (solo le spese Dinner,
      cashflow inclusi); combinazione Conto=Cash + Categoria=Dinner su mese corrente →
      empty state; viste Report (4 card, 7 righe) e Grafico (barre mese/anno) invariate;
      nessun overflow a 390px e tooltip dentro il viewport; nessun errore in console;
      `npm run build` OK.
- [x] **Docs + commit** (fatto): `plan.md` (step [x] + voce in ✅ Completati), `spec.md`
      (sezione "Andamento (balance trend)"), `AGENTS.md` (formula del saldo di apertura +
      clamp del periodo effettivo + filtro Categoria), memoria di sessione.

### Spese ricorrenti (recurring expenses) — implementata il 12/09/2026

> Richiesta utente: poter registrare **spese ricorrenti** (giornaliere, settimanali, mensili,
> annuali) che vengono **proposte come "previste"** e restano tali finché l'utente non le
> conferma; la conferma crea una spesa reale nel giorno/ora della conferma (importo
> modificabile). Le confermate non vengono più proposte nel periodo corrente (giorno /
> settimana / mese / anno). Le previste non confermate si vedono nella Main view **dopo il
> gruppo di oggi e prima dei giorni precedenti**, in una sezione dedicata "Spese previste".
> In Analytics le previste contano in una **categoria dedicata**.
> Decisioni utente (12/09/2026):
> - non confermata per più periodi → **una sola prevista attiva** (quella del periodo
>   corrente); i periodi mancati si **saltano** (nessun arretrato);
> - **nuova pagina "Ricorrenze"** per gestire i template (modifica, pausa/riattiva, stop);
> - in Analytics le previste **contano nei totali** (Totale Spese, Saldo, Media giornaliera)
>   sotto la pseudo-categoria "Spese previste", ma **non toccano i saldi dei conti**;
> - eliminare una spesa **già confermata** → la prevista del periodo **ricompare** (periodo
>   non più consumato);
> - modificare una spesa **già confermata** → comportamento di una spesa normale, **nessun
>   prompt**;
> - in conferma si possono modificare **importo e data/ora** (per retrodatare);
> - punto di ingresso: **menu Azioni → "🔁 Spese ricorrenti"** (pagina Ricorrenze con
>   "+ Crea ricorrenza" nella title bar).
> Default proposti (da confermare in revisione): settimana **lun–dom**; mensile al 31 →
> ultimo giorno del mese; annuale 29/02 → 28/02; previste visibili **solo nei filtri che
> contengono oggi** (Mese corrente / Quest'anno / Tutti) e **fuori dalla paginazione**;
> "Salta questa" = periodo non consumato; conferma **idempotente** (`recurringId` +
> `recurringPeriod` sull'Expense) + "Conferma tutte" + undo con `Toast`; `reimbursable`/
> `notes`/`location` copiati dal template; **coin-split escluso in v1**; modali a 3 pulsanti
> per "Solo questa / Tutte le successive"; cascade su Conto/Categoria estesa alle
> ricorrenze.

- [x] **Docs** (fatto il 12/09/2026): `spec.md` con la sezione "Recurring expenses" (modello,
      occorrenza prevista, conferma, modifica/eliminazione, gestione, cascade, Main view,
      Analytics, backup, UI) e impatti aggiornati (Technical info `DB_VERSION` 2 + store
      `recurringExpenses` + campi `recurringId`/`recurringPeriod`, Main view, Analytics,
      Grafico, Backup/Ripristino, UI redesign, flusso di navigazione, prossime release);
      `plan.md` con questi step.
- [x] **DB + types**: nuovo store `recurringExpenses` con **bump `DB_VERSION` 1 → 2**
      (upgrade che crea solo gli store mancanti; gestione `onblocked` quando un'altra tab ha
      la versione vecchia + messaggio all'utente); CRUD (`getRecurringExpenses`,
      `getRecurringExpense`, `createRecurringExpense`, `updateRecurringExpense`,
      `deleteRecurringExpense`); normalizzazione in lettura; campi `recurringId`/
      `recurringPeriod` su `Expense` (default null) normalizzati in `normalizeExpense`.
- [x] **Util ricorrenze** `src/utils/recurrence.ts` (fatto): chiave periodo (`2026-09-12`,
      `2026-W37`, `2026-09`, `2026`), data di scadenza del periodo corrente (settimana lun–dom,
      mensile 31 → ultimo giorno, annuale 29/02 → 28/02), prossima scadenza, stato
      pending/consumato, etichette frequenza per la UI.
- [x] **AppContext** (fatto): `loadRecurringExpenses`, `saveRecurringExpense`,
      `deleteRecurringExpense` (con pulizia di `recurringId` sulle spese confermate),
      `skipRecurringOccurrence`, `confirmRecurringOccurrence` (crea l'Expense con link in una
      transazione), occorrenze previste derivate; cascade in
      `deleteAccountCascade`/`deleteExpenseTypeCascade` + conteggi in
      `getAccountDeleteInfo`/`getExpenseTypeDeleteInfo`.
- [x] **Pagine ricorrenze** (fatto): `RecurringManagementPage` (`/recurring`), `CreateRecurringPage`
      (`/recurring/new`, `/recurring/:id/edit`, con preview prossima scadenza e switch
      pausa), vista di conferma/modifica prevista (`/recurring/:id/confirm`, importo +
      data/ora, modali 3 pulsanti "Solo questa / Tutte le successive" e "Salta questa /
      Interrompi la ricorrenza"); route in `App.tsx`; voce "🔁 Spese ricorrenti" nel menu
      Azioni della Main view.
- [x] **Main view — sezione "Spese previste"** (fatto): header dedicato, posizionata dopo il gruppo
      di oggi e prima dei giorni precedenti, solo nei filtri che contengono oggi, esclusa
      dalla paginazione (gruppi giorno interi); righe con nome, **badge della frequenza**
      ("🔁 Giornaliera" / "🔁 Settimanale" / "🔁 Mensile" / "🔁 Annuale", pill accanto al
      nome), categoria · conto e importo previsto in grigio; tap → conferma; "Conferma
      tutte" nell'header; `Toast` con Annulla dopo la conferma.
- [x] **Analytics** (fatto): includere le previste in Totale Spese/Saldo/Media giornaliera sotto la
      pseudo-categoria "Spese previste" (colore grigio), nel report (riga marcata
      "prevista"), nel CSV e nel grafico (impilate nella categoria dedicata); nessun effetto
      su saldi conti e Total Cashflow; filtro Categoria non applicato alle previste.
- [x] **Backup/Ripristino v2** (fatto): export con `recurringExpenses` + `version: 2`, import
      retrocompatibile con i file v1 (campo mancante → lista vuota), normalizzazione dei
      nuovi campi, `importAllData` atomico esteso al nuovo store.
- [x] **Test E2E** (fatto, in browser su :5173): template con `startDate` nel passato per verificare il ciclo (giornaliera/
      settimanale/mensile/annuale), conferma con importo diverso (solo questa/tutte), salta,
      interrompi, delete della spesa confermata (prevista che ricompare), pausa, cascade
      conto/categoria, Analytics (totali e pseudo-categoria), CSV, grafico, backup v1→v2 e
      v2→v2; build OK.
- [x] **Chiusura** (fatto): aggiornare `AGENTS.md` (store nuovo, bump `DB_VERSION`, regole) e
      `README.md`, poi `npm run build` + commit + push (deploy GitHub Pages).

### Spese da rimborsare (reimbursable) + riepilogo nello stipendio — implementata il 06/09/2026

> Richiesta utente: segnare le spese che verranno rimborsate (es. trasferte) e, quando si
> inserisce lo stipendio, vedere il **totale delle spese da rimborsare** inserite dopo lo
> stipendio precedente. Decisioni di design (06/09/2026, confermate dall'utente):
> - l'app riconosce lo stipendio da un **flag sull'entrata** (checkbox "Stipendio",
>   `isSalary` sul `Cashflow`), non da euristiche su conto/importo;
> - approccio **"solo finestra di tempo"**: nessuno stato "rimborsata" sulle spese; il
>   totale mostrato è quello delle spese con `reimbursable = true` con **data successiva
>   all'ultimo stipendio precedente registrato** (nessuno stipendio → tutte le spese
>   rimborsabili); edit/delete/rimozione di uno stipendio cambia solo il riferimento per i
>   successivi (niente riconciliazioni);
> - le spese rimborsabili **restano spese normali** in Analytics e nei saldi conti (il
>   totale è informativo, mostrato solo nel form stipendio) → nessuna modifica a Main
>   view/Analytics.

- [x] **DB + types**: campo `reimbursable: boolean` (default false) su `Expense` e
      `isSalary: boolean` (default false) su `Cashflow`; normalizzati in lettura in
      `src/db/database.ts` (`normalizeExpense` / `normalizeCashflow`) e in import in
      `src/utils/backup.ts` (niente bump `DB_VERSION`)
- [x] **Util rimborsi**: nuovo `src/utils/reimbursements.ts` con helper per trovare lo
      stipendio precedente (ultimo Cashflow con `isSalary` e data precedente a quella di
      riferimento) e calcolare **totale + conteggio** delle spese `reimbursable` con data
      successiva allo stipendio precedente (nessuno stipendio → tutte); usato dal form
      entrata con le liste complete dal context (`loadExpenses` / `getCashflows`)
- [x] **Form Spesa (`CreateExpensePage`)**: checkbox "Sarà rimborsata" (crea+edit),
      salvata sul record Expense — anche per la spesa con monete (flag sul record principale
      del gruppo, non sui cashflow generati)
- [x] **Form Entrata (`CreateCashflowPage`)**: checkbox "Stipendio" (`isSalary`); quando
      attiva mostra un pannello "Spese da rimborsare: TOTALE (n)" calcolato con la finestra
      di tempo dello stipendio precedente; nascosto se la checkbox è spenta
- [x] **Main view / Analytics**: nessuna modifica (le spese rimborsabili restano spese
      normali; nessun indicatore extra)
- [x] **Backup/Ripristino**: normalizzazione `reimbursable` / `isSalary` in import +
      verifica round-trip
- [x] **Test E2E** nel browser (spesa rimborsabile, stipendio con totale corretto "a partire
      dallo stipendio precedente", sequenza di più stipendi, edit/rimozione flag stipendio,
      spesa con monete rimborsabile, build OK)

### 🧹 Manutenzione — deprecazione TS `moduleResolution=node10` — completata il 05/09/2026
- [x] **Risolto il warning TypeScript di deprecazione** che compariva in compilazione:
      "Option 'moduleResolution=node10' is deprecated and will stop functioning in
      TypeScript 7.0. Specify compilerOption '\"ignoreDeprecations\": \"6.0\"' to silence
      this error." Veniva da `"moduleResolution": "Node"` (= modalità legacy "node10") in
      `tsconfig.app.json` e `tsconfig.node.json`. Fix applicato (NON silenziato con
      `ignoreDeprecations`): passato a **`"moduleResolution": "Bundler"`** (app Vite e
      `vite.config.ts`; `module` è già `ESNext`), coerente col bundling di Vite. Verificato:
      `npm run build` e `tsc -b` senza warning; nessuna regressione (in `tsconfig.node.json`
      resta `types: ["node"]`).

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

## ⏳ Da fare

> Le attività recenti sono conservate qui con gli step completati; al **04/10/2026** non ci
> sono lavori in corso. L'unica feature pianificata e non iniziata è il **backup/ripristino da
> cloud** (primo blocco qui sotto), a **priorità bassa** per decisione dell'utente. Le altre
> feature candidate sono in **🔮 Prossime release**.
> Le nuove richieste vanno pianificate qui come blocchi di step `[ ]` prima di essere
> implementate, poi marcate `[x]` e riepilogate in ✅ Completati.
> ⚠️ **Prima del `git push` chiedere sempre conferma all'utente**: il push fa partire il
> deploy automatico su GitHub Pages e pubblica subito la nuova versione.

### Inserimento spese più rapido: autofocus importo + dettagli opzionali collassati — implementata il 04/10/2026

> Richiesta utente (04/10/2026): l'app ricava già luogo e categoria in autonomia, quindi nel
> caso migliore va digitato **solo l'importo**. Due rifiniture al form Spesa per avvicinarsi a
> quel flusso senza cambiare la logica di salvataggio.

- [x] **Autofocus sull'importo (solo in creazione)**: al mount del form il campo Importo prende il
      focus (`autoFocus={!expenseId}`), così il tastierino numerico (`inputMode="decimal"`) è
      pronto subito mentre GPS e categoria si risolvono in background; in modifica **nessun**
      autofocus.
- [x] **"Mostra dettagli" (progressive disclosure)**: Data, Ora, "Sarà rimborsata", Note e conto
      secondario in una sezione richiudibile (`showDetails`, sempre montata con `hidden`),
      **chiusa in creazione** e **aperta in modifica**; restano visibili Importo · Luogo ·
      Categoria · Conto. Con la sezione chiusa e un valore non predefinito, la riga "Dettagli
      impostati: …" (`detailSummary`) lo segnala. Validazione e salvataggio invariati.
- [x] **Bug trovato durante il test — virgola decimale scartata**: i campi importo accettavano
      solo `.`, ma su tastiera italiana `inputMode="decimal"` mostra la **virgola**: `12,50`
      diventava `1250` (o `12`) **in silenzio**. Aggiunti `AMOUNT_INPUT_PATTERN` e
      `parseAmountInput` in `src/utils/formatting.ts`, applicati al form Spesa (importo e
      importo dal conto secondario) con guardia su importo non valido, poi **estesi a tutti gli
      altri form importo** (`CreateCashflowPage`, `CreateRecurringPage`, `ConfirmRecurringPage`,
      `CreateAccountPage`).
- [x] **Docs/verifica**: `spec.md` (sezione "Edit or Create Expense") e `AGENTS.md` aggiornati;
      verificato nel browser su `npm run preview` (creazione: tastierino subito, dettagli chiusi,
      riepilogo dopo una modifica; modifica: dettagli aperti e nessun autofocus; salvataggio
      `12,50` → movimento `-12.50`) e `npm run build` OK.

### Creare una spesa da una esistente: "Duplica" e "Ripeti una spesa recente" — implementata il 04/10/2026

> Richiesta utente (04/10/2026): non era chiaro come creare una nuova spesa partendo da una
> esistente (la funzione non c'era). Due scorciatoie complementari nel form Spesa, entrambe
> coerenti con il flusso "solo l'importo".

- [x] **"Ripeti una spesa recente" (chip) nel form di nuova spesa**: riga di chip in cima al form
      di creazione con le ultime spese, una per (luogo, categoria) distinta, dalla più recente.
      Un tap copia **luogo, categoria, conto, note e flag "sarà rimborsata"** e mette il focus
      sull'importo; data/ora restano quelle correnti e l'importo resta vuoto. La copia ferma il
      GPS (un fix tardivo non deve sovrascrivere il luogo copiato) e segna la categoria come
      "manuale" (nessun suggerimento dal luogo la sovrascrive).
- [x] **"Duplica" nella view di modifica**: nuova azione nella title bar (icona copia, nuovo
      `CopyIcon`) che apre `/expense/new?from=<id>`; la pagina di creazione carica la spesa e
      applica lo stesso riempimento. Il Back torna alla modifica della spesa di origine.
- [x] **Bug trovato durante il test — stato trascinato da modifica a creazione**: senza `key`
      React riusava l'istanza di `CreateExpensePage` tra `/expense/:id/edit` e `/expense/new`,
      quindi il form di creazione partiva con importo, data/ora e dettagli aperti della spesa in
      modifica. Aggiunte key distinte alle route in `App.tsx` (expense e cashflow).
- [x] **Docs/verifica**: `spec.md` (sezione "Edit or Create Expense") e `AGENTS.md` aggiornati;
      verificato nel browser (chip con riempimento completo, duplica con importo vuoto e a fuoco,
      Back verso la modifica di origine, salvataggio riuscito, layout title bar 360px+ senza
      troncamento) e `npm run build` OK.

### Backup e ripristino da cloud — pianificata il 03/10/2026, **priorità bassa** (in pausa)

> Richiesta utente (03/10/2026): salvare il backup del database **nel cloud**, non solo come
> file locale, così i dati non dipendono dal dispositivo né dall'origine (reinstallazione
> della PWA, cambio di telefono, passaggio GitHub Pages ↔ server locale).
> **Priorità: bassa** (decisione utente del 03/10/2026): la feature resta pianificata ma non va
> iniziata adesso — nel frattempo l'esigenza è coperta dal backup su file (Esporta/Ripristina).
> Il blocco è pronto per essere ripreso: restano da implementare gli step `[ ]` qui sotto.
> Vincoli del progetto: l'app è **statica su GitHub Pages, senza backend**; nessuna dipendenza
> esterna; i dati sono finanziari e personali → il salvataggio remoto deve essere **esplicito**,
> e le credenziali non devono mai finire nel repo né nei file di backup.
> Nota: è un **backup a istantanee**, non una sincronizzazione multi-dispositivo in tempo reale
> (quella resta una feature separata, molto più complessa).

- [x] **Scelta del provider — decisa con l'utente il 03/10/2026: Google Drive**
      (`appDataFolder`). Storico delle alternative: la prima scelta era **GitHub Gist secret**,
      poi scartata perché un gist secret **non è privato** — docs GitHub: "Secret gists aren't
      private", chiunque abbia l'URL lo legge senza autenticarsi (servirebbe cifratura
      obbligatoria, col rischio "passphrase persa = dati persi"); valutata e scartata anche la
      variante **repository privato dedicato** (accesso ristretto, ma meno comoda). Google Drive
      dà **controllo d'accesso reale** legato all'account Google dell'utente, senza server propri.
      Dettagli da gestire in implementazione:
      - **Progetto Google Cloud + OAuth client ID** (l'ID è pubblico, può stare nel repo) con
        origini JavaScript autorizzate: `https://vcappello.github.io` e `http://localhost:5173`.
      - **Scope minimo**: `drive.appdata` (file invisibile nell'interfaccia di Drive, non occupa
        lo spazio "visibile" dell'utente) — variante `drive.file` se si preferisce un file
        **visibile e ispezionabile** nel Drive.
      - Il flusso OAuth in una SPA statica di norma usa **Google Identity Services**
        (`accounts.google.com/gsi/client`): è uno script di terze parti caricato nell'app, da
        valutare rispetto a un redirect flow con **PKCE** senza script esterno. Le credenziali
        (access token) restano **solo sul dispositivo**.
      - ⚠️ **Da verificare presto**: con la schermata di consenso in stato *Testing* i refresh
        token Google scadono dopo **7 giorni** → da provare con un account reale (eventuale
        pubblicazione della consent screen) prima di promettere un backup davvero automatico.
      - Alternative ancora possibili dietro la stessa interfaccia: **WebDAV / Nextcloud**
        (privacy massima, ma serve un server dell'utente) e **condivisione file (Web Share API)**
        (zero configurazione: dopo l'export si apre il menu di condivisione del telefono).
- [ ] **Architettura**: `src/utils/cloudBackup.ts` con l'interfaccia `CloudProvider`
      (`test()`, `save(payload)`, `load()`); refactor di `src/utils/backup.ts` in
      `collectBackupData()` / `serializeBackup()` / `applyBackup(data)`, così file e cloud
      usano **lo stesso formato** (`BACKUP_VERSION`, stessa normalizzazione) e l'import resta
      quello atomico già esistente (`db.importAllData` + `restoreBackup`).
- [ ] **Credenziali**: token/passphrase in `localStorage` (NON in IndexedDB, così non finiscono
      mai nei file di backup), mai nel bundle né nei log; pagina di configurazione con
      "Prova connessione" e "Scollega" (cancella le credenziali dal dispositivo).
- [ ] **Cifratura: consigliata** (WebCrypto **AES-GCM** con chiave derivata via **PBKDF2** da
      una passphrase dell'utente, applicata prima dell'upload; salt/IV nella busta del payload).
      Con Google Drive i dati sono già protetti dall'account Google, ma **il provider può
      leggerli in chiaro**: con la cifratura il cloud contiene solo testo cifrato e la
      passphrase non lascia mai il dispositivo. Proposta: cifratura **attiva di default**,
      disattivabile con avviso chiaro ("i tuoi dati saranno leggibili dal provider").
      Avviso esplicito: **passphrase persa = dati persi**, nessun recupero. (Con la precedente
      ipotesi GitHub Gist la cifratura sarebbe stata obbligatoria: un gist secret non è privato.)
- [ ] **Auto-backup**: salvataggio automatico con debounce (~30 s) dopo le modifiche e al
      `visibilitychange`, più "Salva ora" manuale; stato "ultimo backup: data/ora" ben visibile
      e promemoria (banner una volta al giorno / `Toast` ⚠️) se l'ultimo backup è più vecchio
      di N giorni.
- [ ] **Ripristino**: lettura dal cloud con anteprima (data, conteggi) e `ConfirmModal` di
      avviso come per l'import da file; errori gestiti con `AlertModal` (offline, token scaduto,
      passphrase errata, payload di versione non supportata) — i dati locali non vanno mai
      toccati finché l'import non riesce.
- [ ] **Conflitti**: il payload include `deviceId` e `savedAt`; se il remoto è più recente del
      locale, chiedere all'utente quale versione tenere (nessun merge automatico).
- [ ] **UI**: nuova view `/backup` (raggiungibile da Azioni nella Main view) con stato,
      configurazione, Salva ora / Ripristina / Scollega; etichette in italiano e componenti
      condivisi (`TitleBar`/`ActionMenu`/`Modal`/`Toast`); niente modali native.
- [ ] **Test**: unit per i pezzi puri (serializzazione, cifratura/decifratura, normalizzazione);
      E2E con **route interception** di Playwright per simulare l'API del provider (nessun token
      reale nei test) e round-trip completo (salva → svuota IndexedDB → ripristina) su
      un'origine di prova; `npm run build` OK.
- [ ] **Documentazione**: `spec.md` (sezione Backup/Ripristino + nota sulle chiamate di rete,
      che restano solo su azione dell'utente), `AGENTS.md` (bullet + "Problemi risolti" quando
      sarà implementata), `README` se serve.

### Icona app non aggiornata su smartphone (cache del service worker) — risolta il 04/10/2026

> Segnalazione utente (04/10/2026): dopo il redesign "scontrino" l'icona vecchia restava
> visibile sullo smartphone, **anche da browser** (favicon), pur senza reinstallare la PWA.

- [x] **Diagnosi**: il deploy è OK e sul server ci sono le icone nuove (verificato con
      `curl` + hash SHA-256 identici ai file locali; workflow #41 `success`). L'HTTP cache di
      GitHub Pages è `max-age=600`, quindi non spiega 16 ore di ritardo: la causa è il
      **service worker**, che serve `/icons/` in **cache-first**. Le icone rigenerate
      conservano lo stesso nome file → stesso URL → `caches.match()` continuava a restituire
      i byte vecchi dalla cache `expense-tracker-v2`, e il browser (favicon compresa) li
      riceveva dal SW.
- [x] **Fix — URL versionati**: `icons/*.png?v=2` in `index.html` (favicon + apple-touch-icon)
      e in `public/manifest.webmanifest`; costante `ICON_VERSION` in `public/sw.js`.
      Un URL nuovo non matcha il vecchio cache e va in rete anche con il SW vecchio attivo;
      il manifest modificato permette ad Android di aggiornare l'icona dell'app installata.
      Da bumparsi **insieme** nei tre punti quando le icone cambiano (documentato in
      `AGENTS.md` e `spec.md`).
- [x] **Fix — service worker**: precache delle icone all'install (`cache: 'reload'` per
      scavalcare l'HTTP cache, errori non bloccanti) e cache bumpata a
      `expense-tracker-v3` (`activate` elimina le cache vecchie).
- [x] **Verifica**: `npm run build` OK; test nel browser su `npm run preview` con un'icona
      stale seminata sotto l'URL non versionato → la richiesta di `icon-192.png?v=2` torna i
      byte nuovi (SHA-256 `4a3e3e9e…`, magic PNG corretto), precache presente nella cache
      `expense-tracker-v3`.

### Icona dell'app — nuovo design "scontrino" — implementata il 03/10/2026

> Richiesta utente (03/10/2026): l'icona precedente (quadrato verde con € "a pixel") non era
> abbastanza riconoscibile; dopo un confronto su anteprime (moneta con € incisa, moneta con
> spicchio mancante, scontrino) l'utente ha scelto lo **scontrino con € e bordo a zig-zag**,
> con la € in **peso regular ingrandita** (non bold) per leggibilità.

- [x] **Anteprime**: generatore di prova in una cartella di sessione (Pillow/FreeType, glifo
      dal font Liberation Sans) con confronto a 512/96/48 px reali e verifica della leggibilità
      (conteggio pixel d'inchiostro): regular a 0.28 = 42 px a 48 px (troppo sottile) → regular
      a 0.34 = 108 px, cioè come il bold a 0.28 (122 px).
- [x] **Port nel generatore del progetto** (`scripts/generate-icons.mjs`, senza dipendenze):
      scontrino bianco con bordo a zig-zag a **3 punte simmetriche** (una punta al centro, così
      la € ha spazio), due righe di testo, € in `#047857`; il glifo arriva dalla maschera 1-bit
      `scripts/euro-glyph.mjs` (150x192 px, estratta dal font). La versione **maskable** riempie
      tutto il canvas senza trasparenza, con lo scontrino nella zona sicura.
- [x] **Verifica**: `npm run icons` + confronto pixel con l'anteprima approvata → differenza
      media 1.56/255 (solo bordi, per l'antialiasing diverso) e € nello stesso riquadro
      (129x173 px); maskable senza trasparenza, 192/180 con angoli arrotondati trasparenti;
      `npm run build` OK.
- [x] **Documentazione**: `AGENTS.md` e `spec.md` aggiornati con il nuovo design e il file della
      maschera del glifo.

### Conto stash "Coins" di default (seed + backfill) — implementato il 03/10/2026

> Richiesta utente (03/10/2026): con il nuovo tipo di conto stash non esiste più il conto
> monete "implicito", quindi l'app deve avere un conto monete **di default**, visibile e
> usabile subito all'apertura, anche su un database già in uso (senza che l'utente lo abbia
> definito); un eventuale conto monete già usato in precedenza resta valido (il flag
> `isCoinAccount` è conservato).
> Decisioni utente (03/10/2026):
> - nome del conto seed: **Coins** (coerente con Cash / Bank account; non è un'etichetta UI).

- [x] **Seed + backfill** (`src/utils/initialization.ts`): il conto `Coins` (id `acc-coins`,
      `isCoinAccount: true`, `isPreferred: true`, giacenza 0) è creato nel seed del database
      vuoto insieme a Cash e Bank account; sui database già esistenti un backfill idempotente
      lo crea all'avvio se non esiste **nessuno** stash e nessun conto chiamato "Coins" (mai
      duplicati, mai cambi di tipo ai conti esistenti). Essendo la funzione attesa prima della
      lettura dei conti all'avvio, il conto è già presente alla prima apertura.
- [x] **Documentazione**: `spec.md` (valori iniziali Account + regola di backfill), `AGENTS.md`
      (dati seed, valori iniziali) e `plan.md` aggiornati.
- [x] **Verifica E2E**: database nuovo → Cash, Bank account e Coins presenti con Coins
      preferito e preselezionato come conto secondario; database con conti esistenti senza
      stash → Coins creato al reload; database con stash esistente (es. conto monete legacy) →
      nessun duplicato; build OK.
- [x] **Stash singolo marcato preferito** (rifinitura richiesta dall'utente, 03/10/2026): se il
      database ha **un solo** stash e non è preferito, all'avvio l'app lo imposta come
      preferito. Motivo: il default del conto secondario è "stash preferito, altrimenti il
      **primo in ordine alfabetico**", quindi senza ★ un nuovo stash con nome precedente (es.
      "A…") scavalcherebbe il conto monete esistente. Con più stash e nessun preferito l'app
      non sceglie (lo decide l'utente). Verificato: stash unico legacy → ★ automatico e
      preselezione stabile anche aggiungendo un nuovo stash; due stash senza preferito →
      nessuna modifica.


### Saldo previsto nel grafico Andamento — implementato il 26/09/2026

Decisioni utente (26/09/2026):
- mantenere la linea continua per il saldo reale e aggiungere la proiezione tratteggiata;
- distinguere le occorrenze previste con indicatori rossi (spese) e verdi (entrate), con
  tooltip dettagliati;
- proiettare fino alla fine del periodo selezionato, con un massimo di 12 mesi per
  "Tutto il periodo".

- [x] **Motore previsione**: proiettare il saldo registrato e le occorrenze ricorrenti
      (spese e entrate) non ancora confermate, rispettando filtri di conto/categoria e stati
      di pausa, conferma e skip.
- [x] **Grafico Andamento**: linea reale continua, saldo previsto tratteggiato, marker
      colorati per tipo e tooltip che descrivono saldo, variazione e movimenti previsti.
- [x] **Verifica e documentazione**: casi per ricorrenze future e una tantum, filtri e
      limiti temporali; aggiornati spec e README; `npm run build` e `git diff --check` OK.

### Vista "Rimborsi in attesa" — implementata il 26/09/2026

- [x] **Accesso e pagina**: aggiunta la voce "💶 Rimborsi in attesa" al menu Azioni della
      Main view e la route `#/reimbursements`.
- [x] **Lista e totale**: mostra spese marcate rimborsabili successive all'ultimo stipendio
      (tutte se non è ancora registrato uno stipendio), totale e conteggio; righe apribili
      nella pagina di modifica spesa.
- [x] **Verifica e documentazione**: riusata la stessa regola temporale del riepilogo
      stipendio; aggiornati spec e README; build OK.

### Statistiche di tendenza in Analytics — implementata

Decisioni utente (26/09/2026):
- aggiungere una vista "Tendenze" ad Analisi;
- mostrare le spese mese per mese sugli ultimi 12 mesi e una linea della media mensile;
- confrontare le medie degli ultimi 3 mesi con quelle dei 3 mesi precedenti per individuare
  categorie in crescita o calo;
- mostrare l'evoluzione delle categorie principali nel tempo;
- riutilizzare i filtri di conto e categoria; includere solo le spese registrate (non le
  occorrenze previste), incluse quelle rimborsabili.

- [x] **Aggregazione**: produrre serie mensili mobili di 12 mesi e confronti per categoria
      sugli ultimi due blocchi di 3 mesi, rispettando i filtri e i movimenti effettivi.
- [x] **Vista Analytics**: aggiungere l'opzione Tendenze e mostrare totale mensile con media,
      ripartizione per categoria e categorie con variazione crescente/calante.
- [x] **Verifica e documentazione**: testare periodi, filtri, categorie nuove/azzerate e dati
      vuoti; aggiornare spec/README/istruzioni e verificare build.

### Ricerca suggerita dei luoghi nel form spesa — implementata il 27/09/2026

Decisioni utente (27/09/2026):
- mentre l'utente digita il campo Luogo, mostrare risultati selezionabili;
- usare Photon per la ricerca autocomplete (il servizio pubblico Nominatim non consente
  autocomplete lato client);
- mantenere il campo modificabile manualmente e il pulsante GPS esistente.

- [x] **Ricerca**: suggerimenti Photon dopo almeno 3 caratteri, con debounce e annullamento
      delle richieste obsolete.
- [x] **Interazione**: selezione accessibile da tocco e tastiera; errore/offline non bloccano
      l'inserimento manuale e il salvataggio.
- [x] **Documentazione e verifica**: attribuzione OpenStreetMap, privacy e servizio esterno
      documentati; test mirati e build.

### Suggerimento della categoria dalla posizione GPS — implementata il 27/09/2026

Obiettivo: velocizzare l'inserimento della spesa usando la posizione come indizio per
selezionare una categoria probabile. La vicinanza a un'attività non garantisce che la spesa
sia stata fatta lì: la categoria resta sempre modificabile e una scelta manuale non viene
sovrascritta. Decisione utente: il luogo è obbligatorio nei form di spesa e va spostato prima
degli altri campi; per spese senza luogo fisico usare la checkbox "Online / nessun luogo".
Le spese ricorrenti senza luogo vengono proposte come Online alla conferma e il valore può
essere cambiato per la singola occorrenza.

Comportamento implementato:
- ricavare una categoria probabile dal tipo OSM restituito dal reverse geocoding; usare anche
  i metadati OSM dei luoghi scelti dalla ricerca testuale;
- dare priorità alle associazioni luogo → categoria già confermate dall'utente in spese
  precedenti; usare il tipo di attività come fallback;
- se il risultato è univoco, selezionare la categoria e informare con un toast; l'utente può
  sempre modificarla manualmente;
- il browser chiede il permesso GPS all'apertura della creazione spesa; coordinate inviate a
  Nominatim soltanto dopo un fix, con digitazione/checkbox Online che interrompono il GPS.

- [x] **Ricerca e classificazione**: usare il tipo OSM del luogo restituito da GPS/Photon e
      associare i tipi di attività alle categorie configurate dall'utente.
- [x] **Apprendimento locale**: riutilizzare le corrispondenze luogo/categoria confermate
      nelle spese precedenti, senza inviare lo storico spese a servizi esterni.
- [x] **Interazione sicura**: selezionare automaticamente solo la categoria univoca,
      informare con un toast, gestire ambiguità e mantenere sempre la scelta manuale.
- [x] **Privacy e verifica**: documentare servizio, dati trasmessi e attribuzione; verificare
      permessi GPS, risultati ambigui, fallback offline e casi senza categoria compatibile.

### Rifiniture UI GPS e categoria nel form spesa — completate

- [x] **GPS automatico**: avviare il rilevamento solo nella creazione spesa; mostrare lo stato
      di caricamento, fermare watch e reverse lookup quando l'utente digita/seleziona Online
      o lascia la pagina; nessuna risposta tardiva deve sovrascrivere il testo digitato.
- [x] **Acquisto online**: sostituire i link testuali per cambiare modalità con una checkbox,
      mantenendo `Online / nessun luogo` come valore persistito e compatibile con le
      ricorrenze.
- [x] **Categoria automatica**: selezionare il match univoco dal luogo e mostrare un toast;
      mantenere una selezione manuale e non assegnare nulla per risultati ambigui/online.
- [x] **Documentazione e verifica**: aggiornare spec, README e istruzioni agenti; verificare
      build e comportamento di creazione/modifica, annullamento GPS e fallback manuale.

### Riconoscimento acquisto online a casa — completato il 01/10/2026

Decisioni utente:
- salvare la posizione di casa dalle coordinate GPS direttamente nel browser, senza inviarla
  a servizi esterni;
- considerare "casa" un raggio di 100 metri; quando il GPS rileva la posizione in quel raggio,
  attivare automaticamente "Online / nessun luogo".

- [x] **Impostazione posizione**: consentire di salvare la posizione GPS rilevata come casa,
      da Main view → Azioni → Posizione casa; mostrare accuratezza e chiedere conferma,
      consentire aggiornamento/rimozione; conservare le coordinate nel solo `localStorage`
      dell'origine, fuori dal backup.
- [x] **Riconoscimento e privacy**: confrontare le coordinate prima del reverse-geocoding;
      entro 100 m selezionare Online senza inviare la posizione a Nominatim. Checkbox sempre
      modificabile per gli acquisti fisici effettuati a casa.
- [x] **Documentazione e verifica**: aggiornare README, spec e istruzioni; verificare formula
      di distanza, attivazione automatica, raggio esterno e assenza di chiamata Nominatim.

### Riepilogo storico nel mese corrente vuoto — implementato il 02/10/2026

Decisioni utente:
- lasciare esplicito che il mese corrente non contiene movimenti;
- se esistono movimenti precedenti, mostrare entrate, spese e saldo dell'ultimo mese con
  movimenti effettivi, anche quando il mese precedente è vuoto;
- non includere le occorrenze previste nel riepilogo.

- [x] **Riepilogo dati**: individuare l'ultimo mese passato con movimenti effettivi e calcolare
      entrate, spese e saldo senza alterare la lista filtrata della Main view.
- [x] **Empty state Main view**: mostrare il mese corrente vuoto e, quando disponibile, il
      riepilogo storico; mantenere il messaggio vuoto se non esiste storico.
- [x] **Documentazione e verifica**: aggiornati spec/README/AGENTS; verificati mese senza
      storico, mese attivo più recente non consecutivo, esclusione routing/previsioni e build.

### Entrate programmate / ricorrenti (stipendio, una tantum) — implementata il 19/09/2026

> Richiesta utente (19/09/2026): estendere le **Ricorrenze** alle **entrate**, così lo
> stipendio (o un affitto incassato, un rimborso periodico) diventa una **prevista** da
> confermare; con la frequenza **"Una sola volta"** si copre anche l'**entrata programmata
> una tantum** (es. rimborso che arriverà il 30/09).
> Perché serve: inserire un'entrata con data futura è già possibile, ma è un record **reale**
> che altera subito saldi conto, totali Analytics e grafico Andamento; la prevista invece non
> muove denaro finché non viene confermata.
> Decisioni utente (19/09/2026):
> - varianti **A + B insieme** (entrata ricorrente + una tantum con frequenza `once`);
> - **un'unica entità** `RecurringExpense` con campo `kind: 'expense' | 'income'` (riuso
>   totale del motore: nessun secondo store, nessuna seconda pagina);
> - **Main view: sezione unica "Movimenti previsti"** (spese previste rosse + entrate
>   previste verdi, ordinate per scadenza);
> - **Analytics: le entrate previste contano nei totali** (Totale Entrate e Saldo, con bucket
>   "Entrate previste"; mai nei saldi conto né nel grafico Andamento);
> - **naming invariato**: pagina/menu "Ricorrenti", con **switch Tipo Spesa/Entrata** nel form.

- [x] **Spec** (fatto il 19/09/2026): `spec.md` con la nuova sezione "Recurring / scheduled
      income" (template con `kind`, frequenza `once`, conferma in `Cashflow`, riepilogo
      rimborsi, gestione, Analytics, cascade, backup) + aggiornamenti: Technical info (link
      `recurringId`/`recurringPeriod` anche su `Cashflow`), Main view ("Movimenti previsti" +
      badge "Una sola volta"), Analytics Report/Grafico/Andamento, Backup (`kind`).
- [x] **Types + normalizzazione** (fatto): `RecurringExpense.kind` (default `'expense'`),
      `RecurringExpense.isSalary` (default false), `Cashflow.recurringId`/`recurringPeriod`
      (default null); normalizzazione in lettura (`normalizeRecurringExpense`,
      `normalizeCashflow` in `database.ts`) e in import (`backup.ts`, con `once` tra le
      frequenze accettate e `kind`/`isSalary` normalizzati). Niente bump `DB_VERSION`:
      verificato che un backup v2 senza `kind` resta valido (`kind` → `expense`).
- [x] **Motore ricorrenze** (fatto): frequenza `once` in `recurrence.ts` (period key = la data
      pianificata, scadenza = `startDate`, `getNextDueDate` = la data stessa) + etichette UI
      ("Una sola volta" / "Una sola volta (data)"); nuovo helper `getOccurrencePeriodKey`
      (period key dalla **scadenza**, necessario per `once` e usato uniformemente da
      `getExpectedOccurrence`, conferma e skip).
- [x] **AppContext** (fatto): `confirmMany` crea un **`Cashflow`** (con `isSalary` dal
      template) quando `kind === 'income'` e un `Expense` altrimenti, in entrambi i casi con
      `recurringId`/`recurringPeriod`; `deleteCashflow` azzera lo stato del periodo del
      template (ripropone la prevista, come `deleteExpense`); undo in blocco con il **tipo**
      dei record creati (`ConfirmedRecurringMovement`); `deleteRecurringExpense` e i cascade
      (`deleteRecurringByIndex`) scollegano anche i **Cashflow** generati (transazioni estese
      alla store `cashflows`); `skipRecurringOccurrence` usa il period key dalla scadenza.
- [x] **Pagine Ricorrenze** (fatto): `CreateRecurringPage` con switch **Tipo Spesa/Entrata**
      (categoria/rimborsabile/luogo solo spese, "Stipendio" solo entrate, placeholder e
      titolo del campo data dinamici: "Data pianificata"/"Movimento previsto" per `once`);
      `RecurringManagementPage` (titolo "Ricorrenti") con badge `entrata`, riga
      categoria·conto (o solo conto), importo `-`/`+` colorato e "Data pianificata" per
      `once`; `ConfirmRecurringPage` con info adattate al tipo, pannello "💶 Spese da
      rimborsare dall'ultimo stipendio" per le entrate con `isSalary` e **nessuna domanda**
      quando cambia l'importo di un template `once`.
- [x] **Main view** (fatto): sezione unica **"Movimenti previsti"** con spese (importo
      grigio, `-`) ed entrate (verde, `+`) ordinate per scadenza, badge frequenza incluso
      "Una sola volta", "Conferma tutte" misto (spese + entrate) e toast con testo adattato
      al tipo ("Entrata/Spesa confermata").
- [x] **Analytics** (fatto): le entrate previste entrano in **Totale Entrate** e **Saldo**
      (meta "+ N previste" sulla card Entrate) con pseudo-bucket **"Entrate previste"** in
      report (importo verde), lista movimenti, CSV (riga "Entrata prevista", segno positivo)
      e grafici (segmento grigio sopra la linea nel giornaliero, barra grigia nel mese con
      conto sintetico); escluse da Top 3 categorie, saldi conto e grafico Andamento.
- [x] **Test E2E + docs** (fatto, dati di test poi rimossi): creazione template entrata da UI
      (switch Tipo, campi condizionali), prevista in "Movimenti previsti" (verde `+2.00K€`),
      Analytics (Totale Entrate 2.00K, Saldo 2.00K, riga "Entrate previste", bucket nel
      grafico mese/giornaliero, CSV "Entrata prevista"; saldi conto e Andamento **invariati**),
      pannello rimborsi nel form di conferma (50.00€ (1 spesa)), conferma → `Cashflow` con
      link e periodo `2026-09`, delete del cashflow → prevista che ritorna, **undo** dal
      toast, `once` (form, nessuna modale sull'importo, periodo = data pianificata, non si
      ripete), "Conferma tutte" mista (1 Expense + 1 Cashflow) e relativo undo, pagina
      Ricorrenti con badge `entrata`/"Data pianificata", backup round-trip (`kind`, `isSalary`
      e link sui cashflow preservati) e file v2 legacy senza `kind` → `expense`; `npm run
      build` OK.

### Manutenzione / rifiniture tecniche — completata il 20/09/2026

- [x] **`noValidate` sui form**: usare i `Toast` ⚠️ per le validazioni dei campi obbligatori
      invece dei bubble nativi HTML5, che bloccano il submit e rendono il Toast quasi
      irraggiungibile. Aggiungere `noValidate` ai form di Spesa, Entrata, Conti, Categorie,
      Ricorrenze e conferma prevista, verificando ogni messaggio di validazione.
- [x] **Id conto con `uuid`**: in `CreateAccountPage` sostituire l’id generato con
      `Date.now().toString()` con `uuidv4()`, come nelle altre pagine, per evitare collisioni
      nella creazione ravvicinata di due conti.

## 🐛 Bug da correggere

*(Tutti i bug elencati sono stati corretti il 16/08/2026 — vedi sezione ✅ Completati.)*

- [x] **(corretto il 04/10/2026) Virgola decimale scartata negli altri form**: la correzione è
      stata applicata prima al form Spesa e poi estesa a `CreateCashflowPage`,
      `CreateRecurringPage`, `ConfirmRecurringPage` e `CreateAccountPage` (giacenza iniziale +
      helper `parseAmount` locale che ora riusa `parseAmountInput`). Verificato nel browser:
      entrata con routing `50,50` → due leg a ±50.50, ricorrenza `9,90` → template a 9.9,
      conferma `11,20` → spesa 11.2, giacenza iniziale `120,75` → saldo 120.75.

## 👀 Osservazioni (limiti noti, da tenere d'occhio)

*(Nessun limite noto aperto al 19/09/2026: il limite "Main view al primo load freddo" è
stato risolto — vedi il bullet in ✅ Completati.)*

## 🔮 Prossime release

> Backlog delle funzionalità candidate (ordine indicativo di valore/costo, non vincolante).
> Quando se ne affronta una va prima pianificata in `⏳ Da fare` come blocco di step `[ ]`,
> poi implementata e riepilogata in ✅ Completati.

- [ ] **Create from photo**: fotocamera smartphone + lettura dello scontrino con AI per creare
      la spesa automaticamente.
- [ ] **Gestione multi-valuta**.
- [x] **Promemoria scadenze ricorrenze**: all'apertura della Main view mostrare una volta al
      giorno un banner ("hai N movimenti previsti") per spese ed entrate programmate non
      confermate, con accesso diretto alla gestione Ricorrenti. Le notifiche PWA via service
      worker restano un'estensione futura, subordinata al consenso dell'utente.
- [x] **Saldo previsto nel grafico Andamento**: linea tratteggiata viola che proietta il saldo
      includendo le occorrenze previste, sia spese sia entrate, accanto al saldo reale.
- [x] **Asse temporale settimanale nel grafico Andamento**: su smartphone mostrare come
      etichetta la data del lunedì di inizio settimana sull'asse X, riducendo le etichette
      sovrapposte e rendendo più leggibile l'andamento.
- [x] **Ricerca movimenti** nella Main view: campo di ricerca testuale su categoria, conto,
      note e luogo, combinabile con i filtri periodo e gli altri filtri esistenti.
- [ ] **Confronto periodo** in Analytics: delta assoluto e percentuale rispetto al periodo
      precedente, nel riepilogo generale e per categoria.
- [ ] **Budget mensile per categoria**: limite di spesa per categoria e/o mese, barra di
      avanzamento in Analisi e avviso al superamento.
- [x] **Vista "Rimborsi in attesa"**: elenco delle spese marcate "Sarà rimborsata" non ancora
      coperte da uno stipendio, riusando `utils/reimbursements.ts`.
- [ ] **Foto allegata alla spesa**: salvare la foto dello scontrino nella spesa e includerla
      nel backup; feature collegata a "Create from photo" e con gestione dello storage.
- [x] **Statistiche di tendenza**: medie per categoria, andamento degli ultimi mesi e
      riepilogo "dove vanno i miei soldi".
- [ ] **Backup/ripristino da cloud (priorità bassa — pianificata in `⏳ Da fare`)**: salvataggio
      delle istantanee del database su Google Drive (`appDataFolder`, OAuth) con cifratura
      opzionale. Non va implementata ora: dettagli e step nella sezione "Backup e ripristino da
      cloud" di `⏳ Da fare`. Alternative future: WebDAV/Nextcloud, condivisione file via Web Share.
