import { Movement, Account, ExpenseType } from '../types';
import { formatDate } from './formatting';

/**
 * Expected (recurring, not yet confirmed) expense to include in the CSV, so the
 * exported rows stay consistent with the Analytics totals.
 */
export interface ExpectedCsvRow {
  dueDate: Date;
  amount: number;
  categoryName: string;
  accountName: string;
}

/**
 * Build a CSV string from the given movements and trigger a download.
 * Uses `;` as delimiter and `,` as decimal separator (Italian Excel convention),
 * with a UTF-8 BOM so special characters display correctly. The expected rows
 * of the recurring expenses are appended (marked "Spesa prevista").
 */
export const exportMovementsToCSV = (
  movements: Movement[],
  accounts: Account[],
  expenseTypes: ExpenseType[],
  expectedRows: ExpectedCsvRow[] = []
): void => {
  const header = ['Data', 'Ora', 'Tipo', 'Categoria', 'Conto', 'Importo (€)'];

  const rows = movements.map((m) => {
    const date = formatDate(m.date);
    const time = m.time || '';
    const type = m.type === 'expense' ? 'Spesa' : 'Entrata';
    const category =
      m.type === 'expense'
        ? expenseTypes.find((et) => et.id === m.expenseTypeId)?.name || ''
        : '';
    const account = accounts.find((a) => a.id === m.accountId)?.name || '';
    // Expenses are stored positive, but the CSV must show them with a negative sign
    const amount = (m.type === 'expense' ? -Math.abs(m.amount) : m.amount)
      .toFixed(2)
      .replace('.', ',');

    return { date: new Date(m.date), cells: [date, time, type, category, account, amount] };
  });

  const expected = expectedRows.map((row) => ({
    date: row.dueDate,
    cells: [
      formatDate(row.dueDate),
      '',
      'Spesa prevista',
      row.categoryName,
      row.accountName,
      (-Math.abs(row.amount)).toFixed(2).replace('.', ','),
    ],
  }));

  // Most recent first (the movements arrive already sorted; the expected rows
  // have only a due date, so they are merged by day).
  const allRows = [...rows, ...expected].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const csvContent = [header, ...allRows.map((r) => r.cells)]
    .map((row) => row.map((cell) => `"${cell}"`).join(';'))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `movimenti_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
