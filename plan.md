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

## 🔄 In corso / Prossimi

*(Nessun punto in corso — sezione completata.)*

## ⏳ Da fare

*(Sezione completata — le attività pianificate (modali custom + tastiera numerica importo) sono state implementate il 23/08/2026 — vedi sezione ✅ Completati.)*

## 🐛 Bug da correggere

*(Tutti i bug elencati sono stati corretti il 16/08/2026 — vedi sezione ✅ Completati.)*

## 👀 Osservazioni (limiti noti, da tenere d'occhio)

- **Main view al primo load freddo**: il filtro "This month" può apparire vuoto subito dopo il caricamento della pagina (transitorio, legato a IndexedDB); cliccando un filtro i dati compaiono.
- **Pagine Analytics/Categories/Accounts**: non caricano i `movements` da sole, dipendono dalla Main view. Con navigazione diretta (reload su `/analytics`) i totali risultano vuoti → valutare un `loadMovements` nel mount di queste pagine.

## 🔮 Prossime release
- [ ] **Create from photo**: fotocamera smartphone + lettura dello scontrino con AI per creare la spesa automaticamente
- [ ] **Gestione multi-valuta**
