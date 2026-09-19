import { describe, expect, it } from 'vitest';
import { isDateOnly, parseDateExpression } from './dates';

const localNoon = (year: number, month: number, day: number): Date =>
  new Date(year, month - 1, day, 12);

describe('date-only validation', () => {
  it.each([
    ['2024-02-29', true],
    ['2026-02-29', false],
    ['2026-04-31', false],
    ['2026-4-01', false],
    ['not-a-date', false],
  ])('validates %s', (value, expected) => {
    expect(isDateOnly(value)).toBe(expected);
  });
});

describe('date expressions', () => {
  it('handles relative dates across a year boundary', () => {
    const now = localNoon(2026, 12, 31);
    expect(parseDateExpression('tomorrow', now)).toEqual({
      status: 'success',
      value: '2027-01-01',
    });
  });

  it('treats a weekday as today when it matches', () => {
    const monday = localNoon(2026, 9, 14);
    expect(parseDateExpression('MONDAY', monday)).toEqual({
      status: 'success',
      value: '2026-09-14',
    });
  });

  it('selects the next non-past year for a yearless numeric date', () => {
    expect(parseDateExpression('1/2', localNoon(2026, 9, 17))).toEqual({
      status: 'success',
      value: '2027-01-02',
    });
  });

  it('handles leap day without Date normalization', () => {
    expect(parseDateExpression('2/29', localNoon(2023, 3, 1))).toEqual({
      status: 'success',
      value: '2024-02-29',
    });
    expect(parseDateExpression('2/29/2024', localNoon(2023, 3, 1))).toEqual({
      status: 'success',
      value: '2024-02-29',
    });
  });

  it('limits yesterday to editing', () => {
    const now = localNoon(2026, 3, 9);
    expect(parseDateExpression('yesterday', now, 'create').status).toBe('error');
    expect(parseDateExpression('yesterday', now, 'edit')).toEqual({
      status: 'success',
      value: '2026-03-08',
    });
  });

  it('adds days using local calendar arithmetic across a DST boundary', () => {
    expect(parseDateExpression('tomorrow', localNoon(2026, 3, 7))).toEqual({
      status: 'success',
      value: '2026-03-08',
    });
  });
});
