import { Movement, Account, ExpenseType } from '../types';
import { formatDate } from './formatting';

/**
 * Build a CSV string from the given movements and trigger a download.
 * Uses `;` as delimiter and `,` as decimal separator (Italian Excel convention),
 * with a UTF-8 BOM so special characters display correctly.
 */
export const exportMovementsToCSV = (
  movements: Movement[],
  accounts: Account[],
  expenseTypes: ExpenseType[]
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

    return [date, time, type, category, account, amount];
  });

  const csvContent = [header, ...rows]
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
