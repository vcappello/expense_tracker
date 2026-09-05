/**
 * Format amount to abbreviated format
 * K for thousands (>999), M for millions (>999,999)
 * with 2 decimal places
 */
export const abbreviateAmount = (amount: number): string => {
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }
  
  if (absAmount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`;
  }
  
  return amount.toFixed(2);
};

/**
 * Format amount as currency with sign and appropriate decimals
 */
export const formatCurrency = (amount: number, currency: string = 'EUR'): string => {
  const formatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return formatter.format(amount);
};

/**
 * Format date to DD/MM/YYYY format
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Format time to HH:mm:ss format (falls back to empty string if missing)
 */
export const formatTime = (time?: string): string => {
  if (!time) return '';
  return time;
};

// Italian abbreviated weekdays indexed by Date#getDay() (0 = Sunday)
const WEEKDAY_ABBREV = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const WEEKDAY_ABBREV_CAP = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
// Italian month names indexed by Date#getMonth() (0 = January)
const MONTH_NAMES_IT = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

/**
 * True when the two dates fall on the same calendar day (local time).
 */
export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * True when the date is today (local time).
 */
export const isToday = (date: Date): boolean => isSameDay(date, new Date());

/**
 * Label of the day section header in the Main view movement list.
 * - compact (single-month ranges): day-of-month + abbreviated weekday, e.g. "4 ven".
 * - wide (Quest'anno / Tutti): full month name is added, e.g. "Settembre 5 Sab";
 *   `includeYear` appends the year (needed when the range spans multiple years).
 */
export const formatDayHeader = (
  date: Date,
  wide: boolean,
  includeYear: boolean
): string => {
  if (wide) {
    const month = MONTH_NAMES_IT[date.getMonth()];
    const weekday = WEEKDAY_ABBREV_CAP[date.getDay()];
    const year = includeYear ? ` ${date.getFullYear()}` : '';
    return `${month} ${date.getDate()} ${weekday}${year}`;
  }
  const weekday = WEEKDAY_ABBREV[date.getDay()];
  return `${date.getDate()} ${weekday}`;
};

/**
 * "Month Year" label (Italian month name capitalized), e.g. "Settembre 2026".
 * Used by the Main view filter button to show the currently displayed range.
 */
export const formatMonthYear = (date: Date): string =>
  `${MONTH_NAMES_IT[date.getMonth()]} ${date.getFullYear()}`;

/**
 * Combine a date with a time string (HH:mm:ss) into a single Date
 * for comparison/sorting purposes.
 */
export const toDateTime = (date: Date | string, time?: string): Date => {
  const d = new Date(date);
  if (time) {
    const [hours, minutes, seconds] = time.split(':').map(Number);
    d.setHours(hours || 0, minutes || 0, seconds || 0, 0);
  }
  return d;
};

/**
 * Get date range based on filter type
 */
export const getDateRange = (
  filter: 'current-month' | 'previous-month' | 'current-year' | 'previous-year' | 'last-5-years' | 'all'
): { start: Date; end: Date } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let start: Date;
  let end = new Date(today);
  end.setHours(23, 59, 59, 999);
  
  switch (filter) {
    case 'current-month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
      
    case 'previous-month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
      
    case 'current-year':
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      break;
      
    case 'previous-year':
      start = new Date(today.getFullYear() - 1, 0, 1);
      end = new Date(today.getFullYear() - 1, 11, 31);
      end.setHours(23, 59, 59, 999);
      break;
      
    case 'last-5-years':
      start = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      break;
      
    case 'all':
      start = new Date(1970, 0, 1);
      end = new Date(2099, 11, 31);
      break;
  }
  
  return { start, end };
};
