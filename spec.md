# Expense Tracker

## Technical info
The WebApp must be optimized for smarphone display.
The Expense Tracker store data in a local database.

Tables:
- Expense
- Cashflow
- ExpenseType
- Account

Default initial values for Account:
- Cash
- Bank account

Default initial values for ExpenseType:
- Dinner
- Shopping
- Fuel
- Tolls

## General consideration
The output of amount values, when indicated as *abbreviated* must display the amount in K when the amount in greather than 999 and in M when the amount is greather than 999.999, with 2 decimal places

## Main view
In the main view is displayed the list of movement by date and time, a movement can be an Expense o a Cashflow. For each item need to display:
- the date and time (hh:mm:ss)
- for Expense: the category name, the Expense amount with negative sign and displayed in red
- for Cashflow: the amount displayed in green (Note: if the Cashflow was created using a routing account only one movement must be displayed with color yellow)
- Edit and Delete buttons on the right side of each item
Movements are sorted by date and time, most recent first.
The movement list must be paginated with automatic load when the user scroll over last displayed line.

List filters:
- date range: current month, previous month, current year, all

Actions:
- New expense: navigate to Edit or Create Expense, this is the most used action and must be accessible always
- New cashflow: navigate to Edit or Create Cashflow, this is the second most used action
- Analytics: navigate to Analytics
- Export to csv: download a csv file with all movement in the filters criteria
- Expense type: navigate to ExpenseType management, used not often
- Account: navigate to Account management, used not often

Actions related to selected movement:
- Edit movement: if the movement is an Expense navigate to Edit or Create Expense, if the movement is a Cashflow navigate to Edit or Create Cashflow
- Delete movement: ask confirm and delete the related Expense or Cashflow

##  Edit or Create Expense
When the user click the new Expense button a new page is displayed.
The user can enter:
- (mandatory) the Expense date, by default the current date, editable by the user
- (mandatory) the Expense time in format hh:mm:ss, by default the current time, editable by the user
- (mandatory) the Expense amount in EUR currency (in the future we will manage multiple currency)
- (mandatory) the ExpenseType. The user can type any value, when the user type text a dropdown listbox display a list of already created ExpenseType that contains the inserted text and the user can select a value from the list. When the inserted text does not match any existing ExpenseType in the dropdown list the first entry is the inserted value with a badge showing the "new" info, the user can create the ExpenseType inline pressing this item. When the item is pressed a message toast display the correct creation of the ExpenseType. When the ExpenseType is created inline the system create a new ExpenseType with the inserted name and with null parent
- (mandatory) the Account. This is a dropdown list, the default is the first defined Account (Cash)

When editing an existing Expense, all fields are pre-populated with the stored values.

Actions:
- Create from photo: open the smartphone camera for take a photo of a receipt, the new Expense is created reading information from the receipt using AI
- Confirm: create the Expense and store it in the local database
- Cancel: go back without save any data (this does not save also any new expese type created)

## Edit or Create Cashflow
When the user click the new Cashflow button a new page is displayed.
The user can enter:
- (mandatory) the Cashflow date, by default the current date, editable by the user
- (mandatory) the Cashflow time in format hh:mm:ss, by default the current time, editable by the user
- (mandatory) the Cashflow amount in EUR currency (in the future we will manage multiple currency)
- (mandatory) the Account
- (optional) a routing Account

When editing an existing Cashflow, all fields are pre-populated with the stored values.

Actions:
- Confirm: create the Cashflow. If the optional routing Account was specified this actions create 2 Cashflow: the first Cashflow with negative amount on the routing Account; the second Cashflow with the positive amount to on the Account
- Cancel: go back without save any data

## ExpenseType management
When the user click ExpenseType button a new page is displayed.
In the ExpenseType management view a tree with all generated ExpenseType with null parent is displayed. ExpenseType can be managed by hierarchy.
For each ExpenseType the user can view:
- ExpenseType name: the name of the ExpenseType
- the total amount *abbreviated* of inserted Expense, in the selected period (filter by date range), including all Expense with ExpenseType in the same hierarchy at any level
- Edit and Delete buttons on the right side
In the same view, when the user click an ExpenseType, the tree node must expand and display also all children ExpenseType with the selected parent.

Actions:
- Create: a new page is displayed to create the ExpenseType, when the user confirm the ExpenseType tree need to refresh
- Edit: a new page is displayed to edit the ExpenseType, when the user confirm the ExpenseType tree need to refresh
- Delete: delete the selected ExpenseType. Note: if exist at least an expense with the selected ExpenseType or exist a child ExpenseType, a critical popup inform that all inserted expenses with the same ExpenseType will be deleted, showing: the counter of inserted Expense, the Expense total amount and the number of children ExpenseType. From the popup the use can:
    - Continue: all expenses with the selected ExpenseType will be deleted and the ExpenseType will be deleted
    - Cancel: nothing happens and go back

### Create / Edit ExpenseType
When the user click create or edit ExpenseType a new page is displayed.
The user can enter:
- (mandatory) the ExpenseType name
- (optional) a parent ExpenseType, this allow to create the hierarchy of ExpanseType

Actions:
- Confirm: create or update the ExpenseType and go back
- Cancel: go back without save any data

## Account management
When the user click Account management button a new page is displayed.
In the account management the list of created account is displayed, for each account is displayed:
- the account name
- last cash flow movement with date, time and amount *abbreviated*
- Edit and Delete buttons on the right side

Actions:
- Create: a new page is displayed to create the Account, when the user confirm the Account list need to refresh
- Edit: a new page is displayed to edit the Account, when the user confirm the Account list need to refresh
- Delete: delete an Account. Note: if exist at least a Cashflow with the selected Account, a critical popup inform that all inserted Cashflow with the same Account will be deleted, showing: the counter of inserted Cashflow, the Cashflow total amount, the counter of inserted Expense, the Expense total amount. From the popup the use can:
    - Continue: all Cashflow with the selected Account will be deleted, all Expense with selected Account will be deleted, the Account will be deleted
    - Cancel: nothing happens and go back

### Create / Edit Account
When the user click create or edit Account a new page is displayed.
The user can enter:
- (mandatory) the Account name

Actions:
- Confirm: create or update the Account and go back
- Cancel: go back without save any data

## Analytics

Filters:
- date range: current month, previous month, current year, previous year, last 5 year
- ExpenseType: allow to filter by ExpenseType, multiple values can be selected
- Account: allow to filter by Account, multiple values can be selected

The Analytics view has two toggle buttons that switch between two visualizations of the filtered movements:
- **Report**: shows the numerical summary and the list of filtered movements
- **Grafico**: shows a graphic of movements by date

### Report
Display a summary card with the following metrics calculated from filtered movements:
- Total Expenses: sum of all Expense amounts in the selected period, displayed in red with negative sign and *abbreviated*
- Total Cashflow: sum of all Cashflow amounts (excluding routing), displayed in green and *abbreviated*
- Net Balance: Total Cashflow - Total Expenses, displayed with color based on sign (green if positive, red if negative) and *abbreviated*
- Average Daily Expense: Total Expenses / number of days in selected period, displayed in red and *abbreviated*
- Top 3 Categories: list of the 3 ExpenseType with highest spending in the period, for each show the category name and the total amount *abbreviated* in red

Display the list of movements matching filters criteria.

### Grafico
The Grafico view shows a chart of the filtered movements (ignoring Cashflow used for routing). The chart type depends on the selected period:

**Daily chart** (for multi-day periods: current/previous year, last 5 years, all):
- Diverging bar chart by day: X axis = days, a zero baseline in the middle.
- Cashflow daily totals are shown as green bars above the baseline.
- Expense daily totals are shown as bars below the baseline, **stacked by ExpenseType category**, each category with its own color.
- A color legend lists the categories (and Entrate).
- Each bar/segment shows a tooltip with date, category and amount; when the period has few days, the daily totals are labeled with *abbreviated* amounts.
- Bars keep a minimum height so small values remain visible.

**Month breakdown chart** (for single-month periods: current month, previous month):
- Separate (not stacked) bars, one per **ExpenseType category** (expenses, downward, colored) and one per **Account** (cashflows, upward, green).
- Each bar is labeled with its name and *abbreviated* amount, with a tooltip and a color legend.

In both charts the movements used for routing (the receiving movement and its negative counterpart) are excluded.

## Progressive Web App (PWA)
The app is installable on the phone home screen and usable offline:
- `manifest.webmanifest` (name, short_name "Spese", icons, theme_color #10b981, display standalone)
- icons generated without external dependencies by `npm run icons` (script `scripts/generate-icons.mjs`, pure PNG encoder): `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `icon-180.png` (apple-touch-icon)
- service worker `public/sw.js`: navigation network-first with fallback to `/index.html` (app shell), static assets (`/assets/`, `/icons/`, manifest) cache-first; data remain local (IndexedDB), no network API
- service worker registered only in production (`import.meta.env.PROD`) to avoid caching during development
- production serving: `npm run build` then `npm run preview` (host 0.0.0.0:4173) or any static server on the `dist/` folder

## User Interface (UI redesign) — Work in progress

> Sezione dedicata al restyling dell'interfaccia grafica. Struttura pronta da compilare.
> Per ogni schermata: descrizione dei cambiamenti desiderati. Il riferimento al wireframe è indicato
> solo dove è disponibile uno schizzo (al momento solo la Main view, `docs/wireframes/main-view.png`);
> le altre schermate restano simili a quelle già esistenti.
> I wireframe vanno messi come immagini PNG/JPG in `docs/wireframes/` (vedi `docs/wireframes/README.md`)
> e allegati anche nella chat di sviluppo per riferimento.

### Design goals
- Mobile-first


### Color palette
- (to be defined) es. colore primario/secondario, 
- Movement colors:
  - Expense red
  - Cashflow in green
  - Routing Cashflow yellow

### Typography
- (to be defined) es. font, dimensioni titoli/importi/etichette...

### Shared components
- **Create button position**: in all the views that allow the creation of elements (Main view, ExpenseType management, Account management) the create button is always placed in the title bar, right aligned.
- **Edit view title bar**: in the edit views (edit Expense, edit Cashflow, edit Account, edit ExpenseType) there is no more "Cancel" button, because the Back button does the same thing: it cancels the modifications and returns to the previous view. In the title bar, right aligned, there are two buttons: Confirm (checkmark icon) and Delete (trash icon).
- **Create view title bar**: in the create views (new Expense, new Cashflow, new Account, new ExpenseType) the Back button cancels and returns to the previous view; there is no "Delete" button (nothing to delete yet), only the Confirm (checkmark icon) button, right aligned in the title bar.
- **Action menu (three lines icon)**: a menu button identified by a three lines (hamburger) icon, placed in the title bar. When pressed it opens a dropdown menu with additional actions. Used in the Main view (Analytics, Conti, Categorie) and in the Analytics view (Esporta CSV and future options).
- **Back button navigation**: the Back button always navigates back in the navigation history to the view of origin (it never pushes a new route, so the back stack is preserved). Example: Main view → Account management → Edit Account: the first Back returns to Account management, the second Back returns to Main view.
- (to be defined) componenti da aggiungere o modificare (es. bottom navigation, FAB, card movimento, header...)

### Main view
- Desired changes: 
  - The title bar contain the view title left aligned. Right aligned there are the two button "+ Spesa" and "+ Entrata"
  - Under the title bar we have an action bar with two button:
    - Filters, identified by an icon of a funnel without text, the button is left aligned to the page, when pressed a dropdown menu is displayed:
      - Mese corrente
      - Mese scorso
      - Quest'anno
      - Tutti
    - Actions, identified by an icons with 3 lines, the button is right aligned to the page, when pressed a dropdown menu is displayed:
      - Analytics
      - Conti
      - Categorie
  - the remaining page contains the movement list, for each item display:
    - date
    - time
    - details that changes for movement type:
      - Expense: display the expense category 
      - Cashflow: display the account
      - routing Cashflow: display bot the source and target account
    - amount with colors:
      - red for Expense
      - green for Cashflow (not routing)
      - yellor for routing Cashflow
    No button is displayed to the right. When a movement is pressed the user navigate to the related edit view. The delete movement is moved inside the edit movement view.

- Wireframe: `docs/wireframes/main-view.png`

### Edit or Create Expense
- Desired changes:
  - Edit view title bar: no "Cancel" button (the Back button cancels the modifications and goes back). Right aligned in the title bar: Confirm (checkmark icon) and Delete (trash icon) buttons (see Shared components).
  - Create view (new Expense): no "Delete" button (nothing to delete yet), only Confirm (checkmark icon) right aligned; Back cancels and goes back (see Shared components).

### Edit or Create Cashflow
- Desired changes:
  - Edit view title bar: no "Cancel" button (the Back button cancels the modifications and goes back). Right aligned in the title bar: Confirm (checkmark icon) and Delete (trash icon) buttons (see Shared components).
  - Create view (new Cashflow): no "Delete" button (nothing to delete yet), only Confirm (checkmark icon) right aligned; Back cancels and goes back (see Shared components).

### Analytics
- Desired changes:
  - The "Report" and "Grafico" toggle buttons are placed in the title bar.
  - The "Export CSV" action is moved into a menu button (three lines icon) in the title bar, like the Main view action menu; this menu can host more options in the future.
  - Filters remain as they are.

### ExpenseType management
- Desired changes:
  - The create button is in the title bar, right aligned (see Shared components).
  - In the list no Edit/Delete buttons are displayed: each item is clickable and navigates to the Edit ExpenseType view (like the Main view movement list); the chevron keeps expanding/collapsing the children. Delete is only available from the Edit ExpenseType view.
  - Edit ExpenseType view title bar: no "Cancel" button (the Back button cancels the modifications and goes back). Right aligned: Confirm (checkmark icon) and Delete (trash icon) buttons (see Shared components).
  - Create ExpenseType view: no "Delete" button, only Confirm (checkmark icon) right aligned; Back cancels and goes back (see Shared components).

### Account management
- Desired changes:
  - The create button is in the title bar, right aligned (see Shared components).
  - In the list no Edit/Delete buttons are displayed: each item is clickable and navigates to the Edit Account view (like the Main view movement list). Delete is only available from the Edit Account view.
  - Edit Account view title bar: no "Cancel" button (the Back button cancels the modifications and goes back). Right aligned: Confirm (checkmark icon) and Delete (trash icon) buttons (see Shared components).
  - Create Account view: no "Delete" button, only Confirm (checkmark icon) right aligned; Back cancels and goes back (see Shared components).

### Navigation flow
- (to be defined) flusso di navigazione tra le schermate, es.:

```mermaid
graph TD
    Main[Main view] --> Expense[Create/Edit Expense]
    Main --> Cashflow[Create/Edit Cashflow]
    Main --> Analytics[Analytics]
    Main --> Types[ExpenseType management]
    Main --> Accounts[Account management]
```

## In the next release
This is a set of feature that can be implemented in the next version of this app:
- multiple currency management
