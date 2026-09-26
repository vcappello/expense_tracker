import { ExpenseType, Movement } from '../types';

export interface MonthlyExpenseTrend {
  key: string;
  label: string;
  total: number;
  expensesByType: Record<string, number>;
}

export interface CategoryExpenseTrend {
  typeId: string;
  typeName: string;
  previousAverage: number;
  recentAverage: number;
  change: number;
  percentageChange: number | null;
  isNew: boolean;
}

export interface ExpenseTrends {
  months: MonthlyExpenseTrend[];
  monthlyAverage: number;
  categoryNames: Record<string, string>;
  categories: CategoryExpenseTrend[];
}

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const monthLabel = (date: Date): string =>
  new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' })
    .format(date)
    .replace('.', '');

export const buildExpenseTrends = (
  movements: Movement[],
  expenseTypes: ExpenseType[],
  selectedAccountIds: string[],
  selectedTypeIds: Set<string>,
  today: Date = new Date()
): ExpenseTrends => {
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 11 + index,
      1
    );
    return {
      key: monthKey(date),
      label: monthLabel(date),
      total: 0,
      expensesByType: {} as Record<string, number>,
    };
  });
  const monthByKey = new Map(months.map((month, index) => [month.key, index]));
  const accountIds = new Set(selectedAccountIds);
  const categoryNames = new Map(expenseTypes.map((type) => [type.id, type.name]));

  movements.forEach((movement) => {
    if (movement.type !== 'expense') return;
    if (accountIds.size > 0 && !accountIds.has(movement.accountId)) return;
    if (selectedTypeIds.size > 0 && !selectedTypeIds.has(movement.expenseTypeId)) return;
    const index = monthByKey.get(monthKey(new Date(movement.date)));
    if (index === undefined) return;

    const month = months[index];
    month.total += movement.amount;
    month.expensesByType[movement.expenseTypeId] =
      (month.expensesByType[movement.expenseTypeId] || 0) + movement.amount;
  });

  const totalsByType = new Map(
    expenseTypes.map((type) => [type.id, { previous: 0, recent: 0 }])
  );
  months.forEach((month, index) => {
    Object.entries(month.expensesByType).forEach(([typeId, amount]) => {
      const totals = totalsByType.get(typeId) ?? { previous: 0, recent: 0 };
      if (index >= 6 && index < 9) totals.previous += amount;
      if (index >= 9) totals.recent += amount;
      totalsByType.set(typeId, totals);
    });
  });

  const categories = [...totalsByType.entries()]
    .map(([typeId, totals]) => {
      const previousAverage = totals.previous / 3;
      const recentAverage = totals.recent / 3;
      return {
        typeId,
        typeName: categoryNames.get(typeId) || 'Categoria sconosciuta',
        previousAverage,
        recentAverage,
        change: recentAverage - previousAverage,
        percentageChange:
          previousAverage > 0
            ? ((recentAverage - previousAverage) / previousAverage) * 100
            : null,
        isNew: previousAverage === 0 && recentAverage > 0,
      };
    })
    .filter((category) => category.previousAverage > 0 || category.recentAverage > 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  return {
    months,
    monthlyAverage: months.reduce((sum, month) => sum + month.total, 0) / months.length,
    categoryNames: Object.fromEntries(categoryNames),
    categories,
  };
};
