import { describe, it, expect } from 'vitest';
import { escapeField, writeRow, writeCsv, parseRow, readCsv } from '../../src/util/csv.js';

describe('escapeField', () => {
  it('leaves a plain value alone', () => {
    expect(escapeField('brazos')).toBe('brazos');
    expect(escapeField(12.4)).toBe('12.4');
  });

  it('quotes a value with a comma', () => {
    expect(escapeField('brazos, ward county')).toBe('"brazos, ward county"');
  });

  it('doubles a quote inside a quoted field', () => {
    expect(escapeField('the 8" hole')).toBe('"the 8"" hole"');
  });

  it('quotes a value with a line break', () => {
    expect(escapeField('two\nlines')).toBe('"two\nlines"');
  });

  it('writes a missing value as empty', () => {
    expect(escapeField(null)).toBe('');
    expect(escapeField(undefined)).toBe('');
  });
});

describe('writeRow and writeCsv', () => {
  it('joins a row', () => {
    expect(writeRow(['a', 'b', 1])).toBe('a,b,1');
  });

  it('writes a header and a row for each record', () => {
    const csv = writeCsv(
      [
        { key: 'well', heading: 'well' },
        { key: 'weight', heading: 'ppg', decimals: 2 },
      ],
      [{ well: 'brazos 14-3', weight: 12.4 }]
    );
    expect(csv).toBe('well,ppg\nbrazos 14-3,12.40\n');
  });

  it('takes a value function', () => {
    const csv = writeCsv([{ heading: 'x', value: (row) => row.a + row.b }], [{ a: 1, b: 2 }]);
    expect(csv).toBe('x\n3\n');
  });

  it('blanks a number that is not finite', () => {
    const csv = writeCsv([{ key: 'v', decimals: 1 }], [{ v: Number.NaN }]);
    expect(csv).toBe('v\n\n');
  });

  it('writes a header alone when there are no records', () => {
    expect(writeCsv([{ key: 'well' }], [])).toBe('well\n');
    expect(writeCsv([{ key: 'well' }], null)).toBe('well\n');
  });
});

describe('parseRow', () => {
  it('splits a plain line', () => {
    expect(parseRow('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('honours quotes', () => {
    expect(parseRow('"brazos, ward",12.4')).toEqual(['brazos, ward', '12.4']);
  });

  it('reads a doubled quote as one', () => {
    expect(parseRow('"the 8"" hole",x')).toEqual(['the 8" hole', 'x']);
  });

  it('keeps empty fields', () => {
    expect(parseRow('a,,c')).toEqual(['a', '', 'c']);
    expect(parseRow('')).toEqual(['']);
  });

  it('refuses a line that ends inside a quote', () => {
    expect(() => parseRow('"unterminated')).toThrow(/inside a quoted field/);
  });
});

describe('readCsv', () => {
  it('keys each record by the header row', () => {
    expect(readCsv('well,ppg\nbrazos,12.4\nward,9.6\n')).toEqual([
      { well: 'brazos', ppg: '12.4' },
      { well: 'ward', ppg: '9.6' },
    ]);
  });

  it('trims the header names', () => {
    expect(readCsv('well , ppg\nbrazos,12.4')).toEqual([{ well: 'brazos', ppg: '12.4' }]);
  });

  it('skips blank lines and reads windows line endings', () => {
    expect(readCsv('a\r\n1\r\n\r\n2\r\n')).toEqual([{ a: '1' }, { a: '2' }]);
  });

  it('refuses a short line and says which one', () => {
    expect(() => readCsv('a,b\n1')).toThrow(/line 2 has 1 fields where the header has 2/);
  });

  it('reads an empty file as no records', () => {
    expect(readCsv('')).toEqual([]);
    expect(readCsv(null)).toEqual([]);
  });

  it('round trips what it writes', () => {
    const csv = writeCsv(
      [{ key: 'well' }, { key: 'note' }],
      [{ well: 'brazos, 14-3', note: 'ran 8" bit' }]
    );
    expect(readCsv(csv)).toEqual([{ well: 'brazos, 14-3', note: 'ran 8" bit' }]);
  });
});
