# Riconciliazione estratto conto bancario — analisi e progetto

> Documento di analisi e progetto della feature di **riconciliazione** tra l'estratto conto
> della banca (file CSV) e i movimenti dell'app. Scritto il **10/10/2026**.
> Stato: **implementata** (fasi 1-6 completate il 10/10/2026: parser, motore di matching,
> pagina di revisione, applicazione su IndexedDB, riallineamento del saldo e tracciamento).
> Il piano a step è in [plan.md](../plan.md) → `⏳ Da fare` (blocco "Riconciliazione estratto
> conto bancario — implementata il 10/10/2026"); la specifica utente in
> [spec.md](../spec.md) → "Bank statement reconciliation".

## 1. Richiesta

Il saldo del conto in banca mostrato dall'app non torna. La banca permette di scaricare
l'elenco dei movimenti: la feature deve **accettare in input il file della banca**,
**trovare per ogni riga la spesa corrispondente**, **mostrare le congruenze** e permettere di
**aggiornare i dati in IndexedDB**. La data usata per il confronto è la **data valuta**,
perché è quella confrontabile con la data della spesa (anche per gli acquisti all'estero).

File di riferimento analizzato: `/home/vincenzo/Downloads/movimenti_1791624566502.csv`.

## 2. Anatomia del file (verificata sul file reale)

| Aspetto | Rilievo |
|---|---|
| Righe | 169 dati: **167 movimenti** (163 uscite, 4 entrate) + 2 ancore (`Saldo iniziale` / `Saldo finale`) |
| Intestazione | `DATA CONTABILE,DATA VALUTA,USCITE,ENTRATE,CAUSALE,DESCRIZIONE OPERAZIONE` |
| Delimitatore | `,`; i campi con virgole sono tra `"` (servono entrambi i casi) |
| Fine riga | CRLF (LF tollerato); BOM opzionale |
| Importi | Formato italiano `+8.102,60` / `-5,95`, in **due colonne** separate (USCITE negative, ENTRATE positive) |
| Date | `DD/MM/YYYY` |
| Congruenza | `8.102,60 + 5.502,40 = 13.605,00` = Saldo finale ✔ (verificato) |
| Data valuta | **Coincide con la data/ora dell'operazione** per tutti i pagamenti carta (139/139), anche in valuta estera; contabile sfasata di 1-3 giorni |
| Valuta estera | 19 righe CHF con `Importo in divisa ≠ Importo in Euro` (conversione già applicata dalla banca) |
| Causali | `Pagamento Carta` (139), `Ricarica Carta Prepagata` (7), `Addebito Diretto` (6), `Accredito Stipendio/Pensione` (4), `Prelievo Carta` (4), `Bonifico In Uscita` (4), `Commissione Ricarica Carta Prepag.` (2), `Bolli Governativi` (1) |

Dati estraibili dalla descrizione (riconosciuti dal parser):

- **esercente** dopo `presso …` (fino a `.Tasso di cambio`, ` - Transazione`, `, C-less`);
- **data/ora operazione** da `del GG/MM/AAAA alle ore HH:MM`;
- **valuta originale** e **importo in divisa** da `Div=XXX` / `Importo in divisa=…`;
- **ultime 4 cifre carta** da `Carta xxxxxxxxNNNN`.

## 3. Il problema: il confronto non può essere a senso unico

Per ogni riga della banca si può cercare la spesa. Ma il confronto riga→spesa **da solo
non basta**: non rileva gli errori presenti **solo** in IndexedDB. La riconciliazione è
quindi **bidirezionale**: un'assegnazione uno-a-uno tra i due insiemi, **scoped allo stesso
conto e allo stesso periodo** (date contabili dello statement). Tutto ciò che avanza da
**entrambi** i lati è un segnale.

| Lato | Avanzo | Significato tipico |
|---|---|---|
| Banca | riga senza movimento | spesa mai inserita · inserita su **un altro conto** · importo/data troppo diversi per matchare |
| **App** | movimento senza riga | **duplicato** · spesa **inventata** · **importo digitato male** · **data sbagliata** · **conto sbagliato** · movimento fuori periodo |

### Tassonomia degli errori e chi li rileva

| Errore in IndexedDB | Rilevato da |
|---|---|
| Importo digitato male | riga `unmatched` **+** spesa app "extra", accoppiate per data+testo → *correggi importo* |
| Spesa duplicata | due movimenti candidati per la stessa riga → il secondo è `appOnly` (`duplicate`) |
| Data sbagliata | match con **date-mismatch** → proponi la data valuta |
| Conto sbagliato (spesa reale su un altro conto) | riga `wrong-account` → *sposta sul conto banca* |
| Spesa inventata / non pagata | `appOnly` (`unmatched-app`) |
| Entrata mancante/doppia/errata | stesso schema, lato entrate |
| Routing non registrato (prelievo/ricarica) | riga `unmatched` con causale di trasferimento (`couldBeRouting`) |
| Errore **precedente** al periodo | non rilevabile riga-per-riga → solo dal confronto `Saldo iniziale` banca vs saldo app |

### Falsi allarmi da evitare

Il perimetro (conto + periodo) è ciò che rende affidabile il lato "extra": una spesa al
**Cash** o su uno **stash**, o un movimento **fuori periodo**, non è un errore e non va
segnalata. Margine di 1-2 giorni alle estremità (una spesa di fine periodo può essere
postata dopo).

## 4. Decisioni concordate con l'utente (10/10/2026)

1. **Scope completo**: correggere i movimenti esistenti (importo EUR, data valuta, ora),
   **creare** quelli mancanti e chiudere con il **riallineamento al saldo finale**.
2. **Confronto bidirezionale**: oltre ai match, riportare le anomalie presenti solo nell'app
   (`appOnly`), con causa probabile e azione proposta.
3. **Ricerca cross-account**: per le righe senza corrispondenza, cercare il movimento anche
   sugli **altri conti** e proporre *"Sposta sul conto banca"* invece di creare un doppione.

## 5. Architettura

Quattro pezzi, con la **logica pura separata dalla UI**:

1. **`src/utils/bankStatement.ts`** (fase 1 — fatto) — parser CSV RFC 4180 scritto a mano
   (quote, virgole nei campi, CRLF, BOM), importi italiani, date `DD/MM/YYYY`, estrazione
   esercente/orario/valuta/carta, riconoscimento delle ancore di saldo. Espone
   `parseBankStatementCsv` e `getStatementNet`. Non lancia eccezioni sulle righe malformate:
   le salta e le segnala in `warnings`.
2. **`src/utils/reconciliation.ts`** (fase 2 — fatto) — `reconcileStatement(rows, movements,
   account, options)` → report puro: righe classificate, anomalie `appOnly`, riepilogo,
   `statementNet`/`appNet`. Non scrive mai su IndexedDB.
3. **Context** (`AppContext`) — metodo batch `applyReconciliation(...)` in **una sola
   transazione** (nuova funzione in `db/database.ts`, sul modello di `importAllData`), più i
   reload. Atomicità: tutto-o-niente.
4. **Pagina** `ReconcileStatementPage.tsx` + route `/reconcile`, voce nel menu Azioni della
   Main view. Stili dedicati con **classi prefissate** (regola anti-collisione CSS).

### Stati di una riga e decisione proposta

| Stato | Significato | Azione |
|---|---|---|
| `matched` | importo **e** data congruenti | collega |
| `ambiguous` | più candidati equivalenti (possibile duplicato) | collega il migliore, evidenzia le alternative |
| `date-mismatch` | importo ok, data oltre la finestra di congruenza (3 gg, entro 7) | aggiorna **data/ora** dalla valuta |
| `amount-mismatch` | stessa identità (giorno + testo) ma importo diverso | aggiorna **importo** (EUR) |
| `wrong-account` | importo esatto ma su un altro conto | **sposta** sul conto banca |
| `unmatched` | nessun candidato | **crea** (spesa / entrata / routing) |
| `before-history` | precedente allo storico tracciato | nulla (creabile su richiesta) |

### Algoritmo di matching

- **Pool candidati**: i movimenti con data nel periodo dello statement (margine 2 gg). Il
  confronto d'importo usa l'effetto firmato sul conto: spesa `−amount` (memorizzata
  positiva), cashflow `+amount`. La data confrontata è **valuta** (fallback contabile).
- **Score** = `0,55·importo + 0,25·data + 0,20·testo` (importo esatto = 1; data 1/(1+giorni);
  testo = overlap dei token tra `causale+esercente` e `location+note`).
- **Assegnazione uno-a-uno** globale (greedy per score decrescente) sugli accoppiamenti
  d'importo congruente **sul conto riconciliato** e **entro la finestra di collegamento
  (7 giorni)**.
- Righe non assegnate: prima il candidato esatto su un **altro conto** (`wrong-account`),
  poi un'identità plausibile con importo diverso (`amount-mismatch`), altrimenti `unmatched`.
- **`appOnly`**: movimenti del conto riconciliato nel periodo non referenziati da nessuna
  riga; `duplicate` se esiste un gemello (stesso importo e stesso giorno) già collegato.

### Movimenti senza controparte reale (coin-split)

Non tutti i record dell'app corrispondono a un movimento bancario:

- la **gamba interna** di un gruppo coin-split (cashflow positivo con `routingPairId` di un
  gruppo che contiene anche una spesa, con `routingAccountId` verso lo stash) **non** esiste
  in banca → esclusa dal matching e da `appOnly` (altrimenti sarebbe un falso positivo
  garantito);
- la **spesa con conto secondario** va confrontata con l'importo **netto** della parte pagata
  dallo stash (la banca addebita solo quella), non con l'importo pieno memorizzato.

Le gambe di routing **reali** (es. prelievo ATM) restano invece matchabili: compaiono
nell'estratto come movimento del conto riconciliato. L'`appNet` continua a usare **tutti** i
movimenti del conto (gamba interna inclusa), per restare coerente con `getAccountBalance`.

### Chiusura del saldo

`Σ righe` = `Saldo finale − Saldo iniziale` (già verificato). Il residuo dopo le correzioni
si chiude con un **`AccountBalanceAdjustment`** datato all'ultima contabile, riusando la
feature "Riallinea saldo" (spec → "Account balance adjustments"). Gli errori **precedenti**
al periodo emergono solo qui: confronto `Saldo iniziale` banca vs saldo app al giorno prima
della prima contabile (`getAccountBalanceAtDate`).

## 6. Raccomandazioni

1. **Idempotenza**: aggiungere campi **opzionali** su `Expense`/`Cashflow`
   (`statementLineId`, `reconciledAt`), normalizzati in lettura (`database.ts`) e in import
   (`backup.ts`) **senza bump di `DB_VERSION`** — stesso pattern di
   `routingPairId`/`notes`/`reimbursable`. Servono a non ricreare i movimenti mancanti a un
   secondo import dello stesso file e a mostrare un badge "✓ riconciliato" in Main view.
   (Alternativa più invasiva: store dedicato con `DB_VERSION` 4 — **non** consigliata.)
2. **Finestra di collegamento conservativa (7 gg)**: gli importi bancari si ripetono spesso
   (5,95 € di caffè); senza limite un movimento di mesi prima verrebbe collegato. Meglio un
   `unmatched` + `appOnly` esplicito di un collegamento sbagliato.
3. **Finestra di congruenza data = 3 giorni** (le spese carta sono sempre a valuta = giorno
   d'acquisto), quindi `date-mismatch` solo tra 4 e 7 giorni.
4. **"Ignora riga"** esplicito (non registrato in DB): per le righe che l'utente non vuole in
   app, così non vengono riproposte come "da creare".
5. **Conferma per riga** su importi in valuta estera (la banca è la fonte di verità, ma la
   conversione può non corrispondere al prezzo pagato).
6. **Movimenti con routing**: spostare un leg da solo romperebbe la coppia `routingPairId` →
   spostamento dell'intero gruppo o avviso; attenzione anche agli **stash** (spostare su/da
   uno stash cambia la semantica del saldo).

## 7. Verifica eseguita (fase 1-2)

Harness Node (moduli puri transpilati con il `tsc` locale, nessuna dipendenza aggiunta) sul
file reale:

- parsing: **167 movimenti, 0 warning**, `Σ = 5.502,40 = Saldo finale − Saldo iniziale` ✔,
  167/167 con data valuta, 143 con orario operazione, 19 in valuta estera, 0 ancore tra i movimenti;
- matching su dataset composto: classificati correttamente `matched`, `ambiguous`,
  `date-mismatch`, `amount-mismatch`, `wrong-account`, `unmatched`, più `appOnly`
  (`duplicate` e `unmatched-app`) — vedi tabella della sezione 5.

## 8. Rischi e note tecniche

- **Parser scritto a mano** (nessuna dipendenza esterna, come impone il progetto); robusto a
  quote/CRLF/BOM/importi italiani.
- **Niente framework di test** nel progetto: la logica pura è verificabile con uno script Node
  temporaneo; il test finale resta manuale nel browser (come da prassi del progetto).
- **Non toccare** `loadMovements` (deve restare full-data), la regola degli **stash**
  (`isCoinAccount`) e i leg dei **routing**.
- **Valuta**: l'app memorizza solo EUR → le 19 righe CHF vanno confermate per riga.
- **CSS globale**: le classi delle pagine convivono → prefissare quelle nuove.
- **Prestazioni**: il pool candidati è filtrato al periodo; il dataset dell'app è comunque
  piccolo (filtri su array, nessun problema).

## 9. Fasi

1. **Parser** `bankStatement.ts` — ✅ fatto, validato sul file reale.
2. **Matching** `reconciliation.ts` — ✅ fatto, validato.
3. **Pagina di revisione** (`/reconcile`) — ✅ fatto, verificato nel browser.
4. **Applicazione** su IndexedDB (batch atomico) + azioni per riga — ✅ fatto, verificato.
5. **Riallineamento** del saldo con `AccountBalanceAdjustment` + tracciamento e badge in Main
   view — ✅ fatto, verificato.
6. **Chiusura**: `spec.md`, `plan.md`, `AGENTS.md`, `README.md`, `npm run build`.

## 10. Punti aperti residui (non bloccanti)

- badge in Main view: risolto con un **"✓"** compatto (`reconciled-badge`), con
  `title`/`aria-label` "Riconciliato con l'estratto conto";
- righe `Bolli`/`Commissioni`: risolto trattandole come le altre — si creano (spesa) se
  l'utente le vuole in app, altrimenti non si applica nulla;
- **movimenti fuori periodo**: oggi esclusi dal report (nessun falso positivo); un'eventuale
  sezione informativa dedicata resta possibile in futuro;
- il confronto col **saldo iniziale** è indicativo (valuta vs contabile) → documentato come
  limite noto sia in `AGENTS.md` sia nella UI;
- eventuali rifiniture future: selezione in blocco dei congruenti, cambio manuale della
  corrispondenza tra le alternative, memoria delle righe "da ignorare" tra un import e l'altro.
