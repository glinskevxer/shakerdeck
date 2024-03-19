import { describe, it, expect } from 'vitest';
import {
  pad,
  truncate,
  wrap,
  heading,
  rule,
  numberCell,
  listPhrase,
  slug,
} from '../../src/util/text.js';

describe('pad', () => {
  it('pads left aligned by default', () => {
    expect(pad('mud', 6)).toBe('mud   ');
  });

  it('pads right for a number column', () => {
    expect(pad('12.5', 8, 'right')).toBe('    12.5');
  });

  it('centres a heading', () => {
    expect(pad('pv', 6, 'centre')).toBe('  pv  ');
    expect(pad('pvy', 6, 'centre')).toBe(' pvy  ');
  });

  it('leaves anything already wide enough alone', () => {
    expect(pad('a much longer value', 4)).toBe('a much longer value');
  });

  it('treats a missing value as blank', () => {
    expect(pad(null, 3)).toBe('   ');
    expect(pad(undefined, 3)).toBe('   ');
    expect(pad(0, 3, 'right')).toBe('  0');
  });

  it('handles a zero or negative width', () => {
    expect(pad('mud', 0)).toBe('mud');
    expect(pad('', -4)).toBe('');
  });
});

describe('truncate', () => {
  it('leaves a short value alone', () => {
    expect(truncate('brazos 14-3', 20)).toBe('brazos 14-3');
  });

  it('marks the cut', () => {
    expect(truncate('brazos 14-3 sidetrack', 12)).toBe('brazos 14-3~');
  });

  it('handles a width of one or zero', () => {
    expect(truncate('mud', 1)).toBe('m');
    expect(truncate('mud', 0)).toBe('');
  });

  it('treats a missing value as blank', () => {
    expect(truncate(null, 5)).toBe('');
  });
});

describe('wrap', () => {
  it('breaks on spaces', () => {
    expect(wrap('the mud is holding its properties well', 15)).toEqual([
      'the mud is',
      'holding its',
      'properties well',
    ]);
  });

  it('splits a word longer than the line', () => {
    expect(wrap('aaaaaaaaaa', 4)).toEqual(['aaaa', 'aaaa', 'aa']);
  });

  it('collapses runs of whitespace', () => {
    expect(wrap('  two    words  ', 20)).toEqual(['two words']);
  });

  it('returns nothing for an empty string', () => {
    expect(wrap('')).toEqual([]);
    expect(wrap(null)).toEqual([]);
  });
});

describe('heading and rule', () => {
  it('upper cases and collapses a heading', () => {
    expect(heading('  daily   mud report ')).toBe('DAILY MUD REPORT');
  });

  it('draws a rule', () => {
    expect(rule(5)).toBe('-----');
    expect(rule(3, '=')).toBe('===');
    expect(rule(0)).toBe('');
  });
});

describe('numberCell', () => {
  it('right aligns to a fixed decimal', () => {
    expect(numberCell(12.5, 2, 8)).toBe('   12.50');
    expect(numberCell(0, 1, 5)).toBe('  0.0');
  });

  it('blanks a value that was never taken', () => {
    expect(numberCell(null, 2, 6)).toBe('      ');
    expect(numberCell(undefined, 2, 6)).toBe('      ');
    expect(numberCell(Number.NaN, 2, 6)).toBe('      ');
  });

  it('prints a non numeric value as it stands', () => {
    expect(numberCell('n/t', 2, 6)).toBe('   n/t');
  });
});

describe('listPhrase', () => {
  it('joins with an and', () => {
    expect(listPhrase(['pv', 'yp'])).toBe('pv and yp');
    expect(listPhrase(['pv', 'yp', 'gels'])).toBe('pv, yp and gels');
  });

  it('handles one item and none', () => {
    expect(listPhrase(['pv'])).toBe('pv');
    expect(listPhrase([])).toBe('');
    expect(listPhrase(null)).toBe('');
  });

  it('drops blanks', () => {
    expect(listPhrase(['pv', '', 'yp'])).toBe('pv and yp');
  });
});

describe('slug', () => {
  it('makes a file name off a well name', () => {
    expect(slug('Brazos 14-3H')).toBe('brazos-14-3h');
    expect(slug('  spaced   out  ')).toBe('spaced-out');
  });

  it('caps the length', () => {
    expect(slug('a'.repeat(100))).toHaveLength(60);
  });

  it('handles a name with nothing usable in it', () => {
    expect(slug('///')).toBe('');
    expect(slug(null)).toBe('');
  });
});
