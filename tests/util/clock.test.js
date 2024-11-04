import { describe, it, expect } from 'vitest';
import {
  readDay,
  daysBetween,
  addDays,
  daysFrom,
  byDay,
  today,
  missingDays,
} from '../../src/util/clock.js';

describe('readDay', () => {
  it('reads a calendar day', () => {
    expect(readDay('2024-12-18').text).toBe('2024-12-18');
  });

  it('trims a day off a sheet', () => {
    expect(readDay(' 2024-12-18 ').text).toBe('2024-12-18');
  });

  it('refuses anything that is not a day', () => {
    expect(() => readDay('18 december')).toThrow(/yyyy-mm-dd/);
    expect(() => readDay('2024-12-18T06:00')).toThrow(/yyyy-mm-dd/);
    expect(() => readDay(null, 'spudded')).toThrow(/spudded must be a date/);
  });

  it('refuses a day that does not exist', () => {
    expect(() => readDay('2024-02-30')).toThrow(/not a real date/);
    expect(() => readDay('2023-02-29')).toThrow(/not a real date/);
  });

  it('takes a leap day that does exist', () => {
    expect(readDay('2024-02-29').text).toBe('2024-02-29');
  });
});

describe('daysBetween', () => {
  it('counts the days', () => {
    expect(daysBetween('2024-12-01', '2024-12-18')).toBe(17);
    expect(daysBetween('2024-12-18', '2024-12-18')).toBe(0);
  });

  it('counts backwards as a negative', () => {
    expect(daysBetween('2024-12-18', '2024-12-01')).toBe(-17);
  });

  it('counts across a month and a year end', () => {
    expect(daysBetween('2024-12-28', '2025-01-04')).toBe(7);
  });

  it('counts across a leap day', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2023-02-28', '2023-03-01')).toBe(1);
  });

  it('is not thrown by a daylight saving change', () => {
    expect(daysBetween('2024-03-09', '2024-03-11')).toBe(2);
    expect(daysBetween('2024-11-02', '2024-11-04')).toBe(2);
  });
});

describe('addDays', () => {
  it('moves a day on', () => {
    expect(addDays('2024-12-18', 4)).toBe('2024-12-22');
  });

  it('moves a day back', () => {
    expect(addDays('2024-01-01', -1)).toBe('2023-12-31');
  });

  it('moves across a leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
  });

  it('inverts daysBetween', () => {
    expect(addDays('2024-12-01', daysBetween('2024-12-01', '2025-02-14'))).toBe('2025-02-14');
  });
});

describe('daysFrom', () => {
  it('runs from one day to another inclusive', () => {
    expect(daysFrom('2024-12-18', '2024-12-21')).toEqual([
      '2024-12-18',
      '2024-12-19',
      '2024-12-20',
      '2024-12-21',
    ]);
  });

  it('is one day for the same day', () => {
    expect(daysFrom('2024-12-18', '2024-12-18')).toEqual(['2024-12-18']);
  });

  it('refuses a run that goes backwards', () => {
    expect(() => daysFrom('2024-12-21', '2024-12-18')).toThrow(/is before/);
  });
});

describe('byDay', () => {
  it('sorts oldest first', () => {
    const rows = byDay([{ date: '2024-12-20' }, { date: '2024-12-18' }]);
    expect(rows.map((row) => row.date)).toEqual(['2024-12-18', '2024-12-20']);
  });

  it('leaves the list it was given alone', () => {
    const rows = [{ date: '2024-12-20' }, { date: '2024-12-18' }];
    byDay(rows);
    expect(rows[0].date).toBe('2024-12-20');
  });

  it('sorts on another field when asked', () => {
    expect(
      byDay([{ spudded: '2024-12-20' }, { spudded: '2024-12-18' }], 'spudded')[0].spudded
    ).toBe('2024-12-18');
  });
});

describe('today', () => {
  it('reads the clock it is given', () => {
    expect(today(() => new Date('2024-12-18T06:00:00Z'))).toBe('2024-12-18');
  });

  it('gives the same answer late in the day', () => {
    expect(today(() => new Date('2024-12-18T23:59:59Z'))).toBe('2024-12-18');
  });
});

describe('missingDays', () => {
  const records = [{ date: '2024-12-18' }, { date: '2024-12-19' }, { date: '2024-12-22' }];

  it('finds the days with no record', () => {
    expect(missingDays(records)).toEqual(['2024-12-20', '2024-12-21']);
  });

  it('finds nothing when the run is unbroken', () => {
    expect(missingDays([{ date: '2024-12-18' }, { date: '2024-12-19' }])).toEqual([]);
  });

  it('takes a run wider than the records', () => {
    expect(missingDays(records, { from: '2024-12-16', to: '2024-12-22' })).toEqual([
      '2024-12-16',
      '2024-12-17',
      '2024-12-20',
      '2024-12-21',
    ]);
  });

  it('finds nothing at all in an empty book', () => {
    expect(missingDays([])).toEqual([]);
  });
});
