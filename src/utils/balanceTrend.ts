import { Account, DateRange, Movement, RecurringExpense } from '../types';
import { formatDate, getDateRange } from './formatting';
import {
  getExpectedOccurrence,
  getNextDueDate,
  getPeriodKey,
  startOfDay,
} from './recurrence';

export interface ScheduledBalanceMovement {
  id: string;
  kind: 'expense' | 'income';
  name: string;
  amount: number;
}

export interface BalancePoint {
  key: string;
  label: string;
  balance: number;
  delta: number;
  projectedBalance?: number;
  projectedDelta?: number;
  scheduledMovements: ScheduledBalanceMovement[];
}

export interface BalanceTrend {
  points: BalancePoint[];
  openingBalance: number;
}

interface BuildBalanceTrendOptions {
  movements: Movement[];
  accounts: Account[];
  recurringExpenses: RecurringExpense[];
  dateRange: DateRange;
  selectedAccountIds: string[];
  expenseTypeIds: Set<string>;
}

const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const addOneYear = (date: Date): Date => {
  const targetYear = date.getFullYear() + 1;
  const lastDay = new Date(targetYear, date.getMonth() + 1, 0).getDate();
  return new Date(targetYear, date.getMonth(), Math.min(date.getDate(), lastDay), 23, 59, 59, 999);
};

const getForecastEnd = (dateRange: DateRange, rangeEnd: Date, today: Date): Date => {
  if (dateRange === 'all') {
    return new Date(Math.min(rangeEnd.getTime(), addOneYear(today).getTime()));
  }
  return rangeEnd;
};

const getScheduledMovements = (
  templates: RecurringExpense[],
  rangeStart: Date,
  forecastEnd: Date,
  today: Date,
  accountIds: Set<string> | null,
  expenseTypeIds: Set<string>
): { date: Date; movement: ScheduledBalanceMovement }[] => {
  const scheduled: { date: Date; movement: ScheduledBalanceMovement }[] = [];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const addOccurrence = (
    template: RecurringExpense,
    dueDate: Date,
    periodKey: string,
    effectiveDate: Date
  ) => {
    if (dueDate < rangeStart || dueDate > forecastEnd) return;
    if (template.lastConfirmedPeriod === periodKey || template.skippedPeriod === periodKey) {
      return;
    }
    scheduled.push({
      date: effectiveDate,
      movement: {
        id: `${template.id}:${periodKey}`,
        kind: template.kind,
        name: template.name,
        amount: template.amount,
      },
    });
  };

  templates.forEach((template) => {
    if (!template.active) return;
    if (accountIds && !accountIds.has(template.accountId)) return;
    if (
      template.kind === 'expense' &&
      expenseTypeIds.size > 0 &&
      !expenseTypeIds.has(template.expenseTypeId)
    ) {
      return;
    }

    const current = getExpectedOccurrence(template, today);
    if (current) {
      addOccurrence(
        template,
        current.dueDate,
        current.periodKey,
        current.dueDate < today ? today : current.dueDate
      );
    }

    let dueDate = getNextDueDate(template.frequency, template.startDate, tomorrow);
    while (dueDate <= forecastEnd) {
      const periodKey = getPeriodKey(template.frequency, dueDate);
      addOccurrence(template, dueDate, periodKey, dueDate);

      const nextStart = new Date(dueDate);
      nextStart.setDate(nextStart.getDate() + 1);
      const nextDueDate = getNextDueDate(template.frequency, template.startDate, nextStart);
      if (nextDueDate <= dueDate) break;
      dueDate = nextDueDate;
    }
  });

  return scheduled;
};

export const buildBalanceTrend = ({
  movements,
  accounts,
  recurringExpenses,
  dateRange,
  selectedAccountIds,
  expenseTypeIds,
}: BuildBalanceTrendOptions): BalanceTrend => {
  const range = getDateRange(dateRange);
  const today = startOfDay(new Date());
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const includesToday = range.start <= todayEnd && range.end >= today;
  const forecastEnd = getForecastEnd(dateRange, range.end, today);
  const accountIds = selectedAccountIds.length > 0 ? new Set(selectedAccountIds) : null;
  const inAccountScope = (accountId: string) => !accountIds || accountIds.has(accountId);
  const countsMovement = (movement: Movement) =>
    movement.type === 'cashflow' ||
    expenseTypeIds.size === 0 ||
    expenseTypeIds.has(movement.expenseTypeId);
  const contribution = (movement: Movement) =>
    movement.type === 'expense' ? -movement.amount : movement.amount;

  const relevant = movements.filter(
    (movement) => inAccountScope(movement.accountId) && countsMovement(movement)
  );
  const plottedRangeEnd = includesToday ? forecastEnd : range.end;
  const inRange = relevant.filter((movement) => {
    const time = new Date(movement.date).getTime();
    return time >= range.start.getTime() && time <= plottedRangeEnd.getTime();
  });
  const scheduled = includesToday
    ? getScheduledMovements(
        recurringExpenses,
        range.start,
        forecastEnd,
        today,
        accountIds,
        expenseTypeIds
      )
    : [];

  const plannedDeltasByDay = new Map<string, number>();
  const scheduledByDay = new Map<string, ScheduledBalanceMovement[]>();
  scheduled.forEach(({ date, movement }) => {
    const key = dayKey(date);
    const delta = movement.kind === 'expense' ? -movement.amount : movement.amount;
    plannedDeltasByDay.set(key, (plannedDeltasByDay.get(key) || 0) + delta);
    scheduledByDay.set(key, [...(scheduledByDay.get(key) || []), movement]);
  });

  const futureMovements = includesToday
    ? relevant.filter((movement) => {
        const time = new Date(movement.date).getTime();
        return time > todayEnd.getTime() && time <= forecastEnd.getTime();
      })
    : [];
  futureMovements.forEach((movement) => {
    const key = dayKey(new Date(movement.date));
    plannedDeltasByDay.set(
      key,
      (plannedDeltasByDay.get(key) || 0) + contribution(movement)
    );
  });

  const hasForecast = includesToday && (scheduled.length > 0 || futureMovements.length > 0);
  if (inRange.length === 0 && !hasForecast) return { points: [], openingBalance: 0 };

  const historicalMovements = inRange.filter(
    (movement) => new Date(movement.date).getTime() <= todayEnd.getTime()
  );
  const firstHistorical = historicalMovements.reduce<number | null>((first, movement) => {
    const time = startOfDay(new Date(movement.date)).getTime();
    return first === null || time < first ? time : first;
  }, null);
  const firstInRange = inRange.reduce<number | null>((first, movement) => {
    const time = startOfDay(new Date(movement.date)).getTime();
    return first === null || time < first ? time : first;
  }, null);

  let startTime = firstHistorical ?? (hasForecast ? today.getTime() : firstInRange);
  if (startTime === null) return { points: [], openingBalance: 0 };
  startTime = Math.max(startTime, startOfDay(range.start).getTime());
  if (hasForecast) startTime = Math.min(startTime, today.getTime());

  let endTime = Math.max(
    Math.min(range.end.getTime(), todayEnd.getTime()),
    ...inRange
      .map((movement) => new Date(movement.date).getTime())
      .filter((time) => time <= todayEnd.getTime()),
    startTime
  );
  if (hasForecast) endTime = Math.max(endTime, startOfDay(forecastEnd).getTime());

  const deltasByDay = new Map<string, number>();
  let openingBalance = accounts
    .filter((account) => inAccountScope(account.id))
    .reduce((sum, account) => sum + (account.initialBalance || 0), 0);

  relevant.forEach((movement) => {
    const when = new Date(movement.date);
    const time = when.getTime();
    const value = contribution(movement);
    if (time < startTime) {
      openingBalance += value;
    } else if (time <= todayEnd.getTime() && time <= endTime) {
      const key = dayKey(when);
      deltasByDay.set(key, (deltasByDay.get(key) || 0) + value);
    }
  });

  const points: BalancePoint[] = [];
  let balance = openingBalance;
  let projectedBalance = 0;
  const cursor = new Date(startTime);
  while (cursor.getTime() <= endTime) {
    const key = dayKey(cursor);
    const delta = deltasByDay.get(key) || 0;
    balance += delta;
    const isForecastDay = hasForecast && cursor.getTime() >= today.getTime();
    const projectedDelta = isForecastDay ? plannedDeltasByDay.get(key) || 0 : undefined;
    if (isForecastDay) projectedBalance += projectedDelta || 0;

    points.push({
      key,
      label: formatDate(cursor),
      balance,
      delta,
      ...(isForecastDay
        ? {
            projectedBalance: balance + projectedBalance,
            projectedDelta,
          }
        : {}),
      scheduledMovements: scheduledByDay.get(key) || [],
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { points, openingBalance };
};
