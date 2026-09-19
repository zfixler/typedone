export type DateExpressionMode = 'create' | 'edit';

export type DateParseResult =
  { status: 'success'; value: string | null } | { status: 'error'; message: string };

const weekdays = new Map<string, number>([
  ['sunday', 0],
  ['sun', 0],
  ['monday', 1],
  ['mon', 1],
  ['tuesday', 2],
  ['tue', 2],
  ['wednesday', 3],
  ['wed', 3],
  ['thursday', 4],
  ['thu', 4],
  ['friday', 5],
  ['fri', 5],
  ['saturday', 6],
  ['sat', 6],
]);

const pad = (value: number): string => String(value).padStart(2, '0');

export const formatLocalDate = (date: Date): string =>
  `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const daysInMonth = (year: number, month: number): number => new Date(year, month, 0, 12).getDate();

const isRealDate = (year: number, month: number, day: number): boolean =>
  year >= 1 &&
  year <= 9999 &&
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= daysInMonth(year, month);

export const isDateOnly = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  return isRealDate(Number(match[1]), Number(match[2]), Number(match[3]));
};

const addLocalDays = (date: Date, amount: number): Date => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  next.setDate(next.getDate() + amount);
  return next;
};

const error = (message: string): DateParseResult => ({ status: 'error', message });

export function parseDateExpression(
  input: string,
  now: Date = new Date(),
  mode: DateExpressionMode = 'create',
): DateParseResult {
  const expression = input.trim().toLocaleLowerCase();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);

  if (expression === 'none') return { status: 'success', value: null };
  if (expression === 'today') return { status: 'success', value: formatLocalDate(today) };
  if (expression === 'tomorrow') {
    return { status: 'success', value: formatLocalDate(addLocalDays(today, 1)) };
  }
  if (expression === 'yesterday') {
    return mode === 'edit'
      ? { status: 'success', value: formatLocalDate(addLocalDays(today, -1)) }
      : error('“yesterday” is only available when editing a task.');
  }

  const weekday = weekdays.get(expression);
  if (weekday !== undefined) {
    const offset = (weekday - today.getDay() + 7) % 7;
    return { status: 'success', value: formatLocalDate(addLocalDays(today, offset)) };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(expression)) {
    return isDateOnly(expression)
      ? { status: 'success', value: expression }
      : error('Enter a real calendar date in YYYY-MM-DD form.');
  }

  const numeric = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(expression);
  if (numeric) {
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    const suppliedYear = numeric[3] ? Number(numeric[3]) : undefined;
    if (suppliedYear !== undefined) {
      if (!isRealDate(suppliedYear, month, day)) {
        return error('Enter a real calendar date.');
      }
      return {
        status: 'success',
        value: `${String(suppliedYear).padStart(4, '0')}-${pad(month)}-${pad(day)}`,
      };
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return error('Enter a real calendar date.');
    }

    const todayValue = formatLocalDate(today);
    for (let year = today.getFullYear(); year <= today.getFullYear() + 8; year += 1) {
      if (isRealDate(year, month, day)) {
        const value = `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
        if (value >= todayValue) {
          return { status: 'success', value };
        }
      }
    }
    return error('Enter a real calendar date.');
  }

  return error('Use today, tomorrow, a weekday, YYYY-MM-DD, or M/D/YYYY.');
}
