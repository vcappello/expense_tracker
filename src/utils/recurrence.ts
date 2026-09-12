import { RecurrenceFrequency, RecurringExpense } from '../types';

/**
 * Recurring expense helpers (see spec.md → "Recurring expenses").
 *
 * A recurring expense template is not a movement: for the **current period**
 * only, it produces at most one **expected occurrence**, which is derived from
 * the template (frequency + startDate) and from the state stored on the
 * template itself (`lastConfirmedPeriod` / `skippedPeriod`). Deriving the
 * occurrence instead of storing it keeps the state minimal and makes the
 * confirmation idempotent.
 */

/** Italian labels used by the UI (frequency badge and selects). */
export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: 'Giornaliera',
  weekly: 'Settimanale',
  monthly: 'Mensile',
  yearly: 'Annuale',
};

export const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'Ogni giorno' },
  { value: 'weekly', label: 'Ogni settimana' },
  { value: 'monthly', label: 'Ogni mese' },
  { value: 'yearly', label: 'Ogni anno' },
];

export const getFrequencyLabel = (frequency: RecurrenceFrequency): string =>
  FREQUENCY_LABELS[frequency] ?? '';

/**
 * Pseudo ExpensesType id/label used by Analytics to aggregate the expected
 * occurrences under a dedicated category (they are not a real ExpenseType).
 */
export const EXPECTED_EXPENSE_TYPE_ID = '__expected__';
export const EXPECTED_EXPENSE_TYPE_LABEL = 'Spese previste';

/** A date at midnight (local time): period math only cares about the day. */
export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * ISO 8601 week number (weeks start on Monday, week 1 contains the first
 * Thursday of the year).
 */
export const getIsoWeek = (date: Date): { year: number; week: number } => {
  const d = startOfDay(date);
  // Thursday of the current week decides the year the week belongs to.
  const day = d.getDay() === 0 ? 7 : d.getDay(); // 1 (Mon) .. 7 (Sun)
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + (4 - day));
  const year = thursday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const firstThursday = new Date(jan1);
  const jan1Day = jan1.getDay() === 0 ? 7 : jan1.getDay();
  firstThursday.setDate(jan1.getDate() + (4 - jan1Day));
  const week =
    1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { year, week };
};

/** Monday of the week containing `date`. */
export const startOfIsoWeek = (date: Date): Date => {
  const d = startOfDay(date);
  const day = d.getDay() === 0 ? 7 : d.getDay(); // 1 (Mon) .. 7 (Sun)
  d.setDate(d.getDate() - (day - 1));
  return d;
};

/**
 * Period key of the period containing `date`, depending on the frequency:
 * daily `2026-09-12`, weekly `2026-W37`, monthly `2026-09`, yearly `2026`.
 * Used to mark a period as consumed (confirmed) or skipped.
 */
export const getPeriodKey = (frequency: RecurrenceFrequency, date: Date): string => {
  const d = startOfDay(date);
  switch (frequency) {
    case 'daily':
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    case 'weekly': {
      const { year, week } = getIsoWeek(d);
      return `${year}-W${pad2(week)}`;
    }
    case 'monthly':
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    case 'yearly':
      return String(d.getFullYear());
  }
};

/**
 * Start of the period of the given frequency containing `date`
 * (day / Monday / first of month / first of January).
 */
export const getPeriodStart = (frequency: RecurrenceFrequency, date: Date): Date => {
  const d = startOfDay(date);
  switch (frequency) {
    case 'daily':
      return d;
    case 'weekly':
      return startOfIsoWeek(d);
    case 'monthly':
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case 'yearly':
      return new Date(d.getFullYear(), 0, 1);
  }
};

/**
 * Due date of the occurrence that belongs to the period containing `reference`,
 * computed from the template `startDate`:
 * - daily: the day itself;
 * - weekly: the weekday of the start date, in that week (Monday-based);
 * - monthly: the day of month of the start date, clamped to the last day of
 *   the month (e.g. the 31st → 30/28);
 * - yearly: the month/day of the start date, with 29/02 → 28/02 in non-leap
 *   years.
 */
export const getDueDateInPeriod = (
  frequency: RecurrenceFrequency,
  startDate: Date,
  reference: Date
): Date => {
  const start = startOfDay(startDate);
  const ref = startOfDay(reference);

  const clampDay = (year: number, month: number, day: number): Date => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay));
  };

  switch (frequency) {
    case 'daily':
      return ref;
    case 'weekly': {
      const periodStart = startOfIsoWeek(ref);
      const weekday = start.getDay() === 0 ? 7 : start.getDay(); // 1..7
      const due = new Date(periodStart);
      due.setDate(periodStart.getDate() + (weekday - 1));
      return due;
    }
    case 'monthly':
      return clampDay(ref.getFullYear(), ref.getMonth(), start.getDate());
    case 'yearly':
      return clampDay(ref.getFullYear(), start.getMonth(), start.getDate());
  }
};

/** Advance `date` by one period of the given frequency. */
const addPeriod = (frequency: RecurrenceFrequency, date: Date): Date => {
  const d = startOfDay(date);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      return d;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      return d;
    case 'monthly':
      return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    case 'yearly':
      return new Date(d.getFullYear() + 1, 0, 1);
  }
};

/**
 * First due date greater than or equal to `from` (and not before the template
 * start date). Used by the management page / form preview ("prossima
 * scadenza").
 */
export const getNextDueDate = (
  frequency: RecurrenceFrequency,
  startDate: Date,
  from: Date = new Date()
): Date => {
  const start = startOfDay(startDate);
  let reference = startOfDay(from);
  if (reference < start) reference = start;

  for (let i = 0; i < 400; i += 1) {
    const due = getDueDateInPeriod(frequency, start, reference);
    if (due >= reference && due >= start) return due;
    reference = addPeriod(frequency, reference);
  }
  return getDueDateInPeriod(frequency, start, reference);
};

/** An expected (not yet confirmed) occurrence, derived from a template. */
export interface ExpectedOccurrence {
  template: RecurringExpense;
  dueDate: Date;
  periodKey: string;
  amount: number;
}

/**
 * Expected occurrence of a template for "today", or null when there is none:
 * the template is paused, already confirmed for the current period, skipped for
 * the current period, not started yet, or not due yet in the current period.
 */
export const getExpectedOccurrence = (
  template: RecurringExpense,
  today: Date = new Date()
): ExpectedOccurrence | null => {
  if (!template.active) return null;

  const reference = startOfDay(today);
  const periodKey = getPeriodKey(template.frequency, reference);
  if (template.lastConfirmedPeriod === periodKey) return null;
  if (template.skippedPeriod === periodKey) return null;

  const startDate = startOfDay(template.startDate);
  const dueDate = getDueDateInPeriod(template.frequency, startDate, reference);
  if (dueDate < startDate) return null; // the recurrence has not started yet
  if (dueDate > reference) return null; // not due yet in the current period

  return { template, dueDate, periodKey, amount: template.amount };
};

/** All the expected occurrences of the given templates, ordered by due date. */
export const getExpectedOccurrences = (
  templates: RecurringExpense[],
  today: Date = new Date()
): ExpectedOccurrence[] =>
  templates
    .map((template) => getExpectedOccurrence(template, today))
    .filter((occurrence): occurrence is ExpectedOccurrence => occurrence !== null)
    .sort((a, b) => {
      const diff = a.dueDate.getTime() - b.dueDate.getTime();
      return diff !== 0 ? diff : a.template.name.localeCompare(b.template.name);
    });
