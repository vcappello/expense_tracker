import { Expense, ExpenseType } from '../types';

export const ONLINE_LOCATION_VALUE = 'Online / nessun luogo';

export interface PlaceCategoryMetadata {
  category?: string;
  type?: string;
}

export interface LocationCategorySuggestion {
  expenseTypeId: string;
  source: 'history' | 'place-type';
}

const CATEGORY_GROUPS: {
  osmTypes: string[];
  categoryAliases: string[];
}[] = [
  {
    osmTypes: [
      'restaurant',
      'fast_food',
      'cafe',
      'bar',
      'pub',
      'food_court',
      'ice_cream',
      'biergarten',
      'bakery',
      'butcher',
      'cheese',
      'deli',
      'greengrocer',
      'seafood',
    ],
    categoryAliases: [
      'dinner',
      'restaurant',
      'ristorante',
      'cena',
      'pranzo',
      'food',
      'cibo',
      'bar',
      'cafe',
      'caffè',
      'caffe',
      'fast food',
      'bakery',
      'panificio',
      'alimentari',
    ],
  },
  {
    osmTypes: [
      'supermarket',
      'convenience',
      'department_store',
      'mall',
      'general',
      'clothes',
      'shoes',
      'bookshop',
      'chemist',
      'hardware',
      'electronics',
      'gift',
      'marketplace',
    ],
    categoryAliases: [
      'shopping',
      'shop',
      'shopping',
      'spesa',
      'supermarket',
      'supermercato',
      'market',
      'negozio',
      'store',
      'acquisti',
    ],
  },
  {
    osmTypes: ['fuel'],
    categoryAliases: ['fuel', 'benzina', 'carburante', 'gas station', 'stazione di servizio'],
  },
  {
    osmTypes: ['toll_booth'],
    categoryAliases: ['tolls', 'toll', 'pedaggio', 'pedaggi', 'autostrada'],
  },
];

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const includesTerm = (normalizedValue: string, term: string): boolean =>
  ` ${normalizedValue} `.includes(` ${normalize(term)} `);

const findHistoricalCategory = (
  location: string,
  expenses: Expense[],
  expenseTypes: ExpenseType[],
  excludeExpenseId?: string
): string | null => {
  const normalizedLocation = normalize(location);
  if (!normalizedLocation) return null;

  const validTypeIds = new Set(expenseTypes.map((type) => type.id));
  const counts = new Map<string, number>();
  expenses.forEach((expense) => {
    if (
      expense.id === excludeExpenseId ||
      !validTypeIds.has(expense.expenseTypeId) ||
      normalize(expense.location) !== normalizedLocation
    ) {
      return;
    }
    counts.set(
      expense.expenseTypeId,
      (counts.get(expense.expenseTypeId) || 0) + 1
    );
  });

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] === ranked[1]?.[1]) return null;
  return ranked[0][0];
};

const findCategoryByPlaceType = (
  metadata: PlaceCategoryMetadata,
  expenseTypes: ExpenseType[]
): string | null => {
  const osmType = normalize(`${metadata.category || ''} ${metadata.type || ''}`);
  if (!osmType) return null;

  const matchingGroups = CATEGORY_GROUPS.filter((group) =>
    group.osmTypes.some((type) => includesTerm(osmType, type))
  );
  if (matchingGroups.length !== 1) return null;

  const group = matchingGroups[0];
  const matchingTypes = expenseTypes.filter((expenseType) => {
    const name = normalize(expenseType.name);
    return group.categoryAliases.some((alias) => includesTerm(name, alias));
  });
  return matchingTypes.length === 1 ? matchingTypes[0].id : null;
};

export const suggestExpenseTypeForLocation = (
  location: string,
  metadata: PlaceCategoryMetadata,
  expenses: Expense[],
  expenseTypes: ExpenseType[],
  excludeExpenseId?: string
): LocationCategorySuggestion | null => {
  if (!location || location === ONLINE_LOCATION_VALUE) return null;

  const historicalTypeId = findHistoricalCategory(
    location,
    expenses,
    expenseTypes,
    excludeExpenseId
  );
  if (historicalTypeId) {
    return { expenseTypeId: historicalTypeId, source: 'history' };
  }

  const placeTypeId = findCategoryByPlaceType(metadata, expenseTypes);
  return placeTypeId
    ? { expenseTypeId: placeTypeId, source: 'place-type' }
    : null;
};
