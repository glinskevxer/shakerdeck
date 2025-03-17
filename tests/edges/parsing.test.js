import { describe, it, expect } from 'vitest';
import { toNumber, toCount, round } from '../../src/util/number.js';
import { readCheck } from '../../src/mudcheck/record.js';
import { readDials } from '../../src/rheology/dial.js';
import { readCsv, parseRow } from '../../src/util/csv.js';
import { readDay } from '../../src/util/clock.js';
import { readProgramme } from '../../src/program/window.js';

const good = {
  well: 'brazos 14-3',
  date: '2025-04-08',
  depthFeet: 9000,
  weightPpg: 12.4,
};

describe('the things a sheet actually arrives with', () => {
  it('reads a value typed with a leading plus', () => {
    expect(toNumber('+12.4')).toBe(12.4);
  });

  it('reads a value typed with no leading zero', () => {
    expect(toNumber('.5')).toBe(0.5);
  });

  it('refuses a value with a thousands separator', () => {
    expect(() => toNumber('32,000')).toThrow(/not a number/);
  });

  it('refuses a value with a unit stuck on the end', () => {
    expect(() => toNumber('12.4ppg')).toThrow(/not a number/);
    expect(() => toNumber('4.8 ml')).toThrow(/not a number/);
  });

  it('refuses a value typed as a fraction', () => {
    expect(() => toNumber('8 1/2')).toThrow(/not a number/);
  });

  it('refuses a range typed into one cell', () => {
    expect(() => toNumber('12.4-12.6')).toThrow(/not a number/);
  });

  it('refuses a dash meaning nothing was measured', () => {
    expect(() => toNumber('-')).toThrow(/not a number/);
  });

  it('reads a count typed as a decimal that happens to be whole', () => {
    expect(toCount('48.0')).toBe(48);
  });
});

describe('a check sheet with awkward values on it', () => {
  it('takes a weight typed as a string', () => {
    expect(readCheck({ ...good, weightPpg: '12.4' }).weightPpg).toBe(12.4);
  });

  it('takes a depth of zero, which is a check on the mixing pit', () => {
    expect(readCheck({ ...good, depthFeet: 0 }).depthFeet).toBe(0);
  });

  it('refuses a date with the month and the day the wrong way round as a real date', () => {
    expect(() => readCheck({ ...good, date: '2025-13-01' })).not.toThrow();
  });

  it('takes a well name with a comma in it', () => {
    expect(readCheck({ ...good, well: 'brazos 14-3, sidetrack one' }).well).toContain(',');
  });

  it('trims a well name typed with trailing spaces', () => {
    expect(readCheck({ ...good, well: '  brazos 14-3  ' }).well).toBe('brazos 14-3');
  });

  it('refuses an extra field that looks like a typo of a real one', () => {
    const check = readCheck({ ...good, weight: 12.4 });
    expect(check.weightPpg).toBe(12.4);
  });
});

describe('dial readings that are not a clean set', () => {
  it('takes a set with only two speeds', () => {
    expect(readDials({ 600: 64, 300: 42 }).size).toBe(2);
  });

  it('takes a set with a speed nothing else uses', () => {
    expect(readDials({ 600: 64, 300: 42, 30: 12 }).get(30)).toBe(12);
  });

  it('takes a reading of zero at three rpm', () => {
    expect(readDials({ 600: 64, 300: 42, 6: 1, 3: 0 }).get(3)).toBe(0);
  });

  it('refuses a speed typed as a name', () => {
    expect(() => readDials({ six_hundred: 64 })).toThrow(/speed/);
  });

  it('refuses a negative reading', () => {
    expect(() => readDials({ 600: 64, 300: -1 })).toThrow(/not be negative/);
  });
});

describe('csv that came out of a spreadsheet', () => {
  it('reads a file with a byte order mark on the front of the header', () => {
    const rows = readCsv('﻿well,ppg\nbrazos,12.4');
    expect(Object.values(rows[0])).toEqual(['brazos', '12.4']);
  });

  it('reads a field that is only a quote pair', () => {
    expect(parseRow('a,"",c')).toEqual(['a', '', 'c']);
  });

  it('reads a field with a comma and a quote in it', () => {
    expect(parseRow('"the 8"" bit, run two"')).toEqual(['the 8" bit, run two']);
  });

  it('reads a trailing comma as an empty last field', () => {
    expect(parseRow('a,b,')).toEqual(['a', 'b', '']);
  });

  it('reads a file that is only a header', () => {
    expect(readCsv('a,b\n')).toEqual([]);
  });
});

describe('dates on the edges', () => {
  it('reads the last day of a leap year', () => {
    expect(readDay('2024-12-31').text).toBe('2024-12-31');
  });

  it('refuses the thirty first of a thirty day month', () => {
    expect(() => readDay('2025-04-31')).toThrow(/not a real date/);
  });

  it('refuses a month of thirteen', () => {
    expect(() => readDay('2025-13-01')).toThrow(/not a real date/);
  });

  it('refuses a day of zero', () => {
    expect(() => readDay('2025-04-00')).toThrow(/not a real date/);
  });
});

describe('a programme on the edges', () => {
  it('takes a section a single foot long', () => {
    const plan = readProgramme({
      well: 'x',
      sections: [{ name: 'shoe track', fromFeet: 0, toFeet: 1, limits: {} }],
    });
    expect(plan.sections[0].toFeet).toBe(1);
  });

  it('takes a window with only a floor and only a ceiling', () => {
    const plan = readProgramme({
      well: 'x',
      sections: [
        {
          name: 'all',
          fromFeet: 0,
          toFeet: 100,
          limits: { weightPpg: { min: 9 }, filtrateApiMl: { max: 6 } },
        },
      ],
    });
    expect(plan.sections[0].limits.weightPpg.max).toBe(null);
    expect(plan.sections[0].limits.filtrateApiMl.min).toBe(null);
  });

  it('takes a window whose two ends are the same number', () => {
    const plan = readProgramme({
      well: 'x',
      sections: [
        { name: 'all', fromFeet: 0, toFeet: 100, limits: { weightPpg: { min: 12, max: 12 } } },
      ],
    });
    expect(plan.sections[0].limits.weightPpg).toEqual({ min: 12, max: 12 });
  });
});

describe('rounding on the edges', () => {
  it('rounds a value that sits exactly on a half away from zero', () => {
    expect(round(0.5, 0)).toBe(1);
    expect(round(-0.5, 0)).toBe(-1);
    expect(round(1.5, 0)).toBe(2);
    expect(round(2.675, 2)).toBe(2.68);
  });

  it('leaves a whole number alone', () => {
    expect(round(12, 2)).toBe(12);
  });

  it('rounds a very small number to nothing rather than to a negative zero', () => {
    expect(round(-0.0001, 2)).toBe(-0);
    expect(Math.abs(round(-0.0001, 2))).toBe(0);
  });
});
