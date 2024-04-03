import { describe, it, expect } from 'vitest';
import {
  SchemaError,
  requireObject,
  requireArray,
  requireString,
  optionalString,
  requireNumber,
  optionalNumber,
  requireOneOf,
  rejectUnknown,
  eachRecord,
} from '../../src/valid/schema.js';

describe('requireObject', () => {
  it('passes an object through', () => {
    const value = { a: 1 };
    expect(requireObject(value, 'check')).toBe(value);
  });

  it('refuses a list, a null and a scalar', () => {
    expect(() => requireObject([], 'check')).toThrow(/check: expected an object/);
    expect(() => requireObject(null, 'check')).toThrow(/expected an object/);
    expect(() => requireObject('x')).toThrow(SchemaError);
  });

  it('leaves the path off when there is none', () => {
    expect(() => requireObject(null)).toThrow(/^expected an object$/);
  });
});

describe('requireArray', () => {
  it('passes a list through', () => {
    expect(requireArray([1], 'rows')).toEqual([1]);
  });

  it('applies a minimum length', () => {
    expect(() => requireArray([], 'rows', { minimum: 1 })).toThrow(
      /rows: expected at least 1 entries, found 0/
    );
  });

  it('refuses an object', () => {
    expect(() => requireArray({}, 'rows')).toThrow(/expected a list/);
  });
});

describe('requireString and optionalString', () => {
  it('trims a string', () => {
    expect(requireString({ well: '  brazos  ' }, 'well')).toBe('brazos');
  });

  it('refuses a blank or missing string', () => {
    expect(() => requireString({ well: '  ' }, 'well', 'check')).toThrow(
      /check.well: expected a non empty string/
    );
    expect(() => requireString({}, 'well')).toThrow(/well: expected a non empty string/);
    expect(() => requireString({ well: 4 }, 'well')).toThrow(/non empty string/);
  });

  it('falls back when an optional string is missing', () => {
    expect(optionalString({}, 'note')).toBe(null);
    expect(optionalString({ note: null }, 'note', 'none')).toBe('none');
    expect(optionalString({ note: ' seen ' }, 'note')).toBe('seen');
  });

  it('still refuses an optional string of the wrong type', () => {
    expect(() => optionalString({ note: 4 }, 'note', null, 'check')).toThrow(
      /check.note: expected a string/
    );
  });
});

describe('requireNumber', () => {
  it('reads a number or a numeric string', () => {
    expect(requireNumber({ ppg: 12.4 }, 'ppg')).toBe(12.4);
    expect(requireNumber({ ppg: '12.4' }, 'ppg')).toBe(12.4);
  });

  it('names the field and the file position', () => {
    expect(() => requireNumber({ ppg: 'heavy' }, 'ppg', 'check')).toThrow(
      /check.ppg: is not a number: heavy/
    );
    expect(() => requireNumber({}, 'ppg')).toThrow(/ppg/);
  });

  it('applies a minimum, a maximum and an exclusive floor', () => {
    expect(() => requireNumber({ ppg: 7 }, 'ppg', '', { minimum: 8 })).toThrow(
      /must not be below 8, found 7/
    );
    expect(() => requireNumber({ ppg: 25 }, 'ppg', '', { maximum: 22 })).toThrow(
      /must not be above 22, found 25/
    );
    expect(() => requireNumber({ ppg: 0 }, 'ppg', '', { above: 0 })).toThrow(
      /must be above 0, found 0/
    );
    expect(requireNumber({ ppg: 8 }, 'ppg', '', { minimum: 8, maximum: 22 })).toBe(8);
  });
});

describe('optionalNumber', () => {
  it('falls back for missing, null and blank', () => {
    expect(optionalNumber({}, 'gel')).toBe(null);
    expect(optionalNumber({ gel: null }, 'gel', 0)).toBe(0);
    expect(optionalNumber({ gel: '' }, 'gel', 0)).toBe(0);
  });

  it('reads and ranges a value that is there', () => {
    expect(optionalNumber({ gel: '6' }, 'gel', 0)).toBe(6);
    expect(() => optionalNumber({ gel: -1 }, 'gel', 0, 'check', { minimum: 0 })).toThrow(
      /check.gel: must not be below 0/
    );
  });
});

describe('requireOneOf', () => {
  it('accepts a known value', () => {
    expect(requireOneOf({ base: 'water' }, 'base', ['water', 'oil'])).toBe('water');
  });

  it('lists what was allowed', () => {
    expect(() => requireOneOf({ base: 'air' }, 'base', ['water', 'oil'], 'mud')).toThrow(
      /mud.base: expected one of water, oil/
    );
    expect(() => requireOneOf({}, 'base', ['water'])).toThrow(/expected one of water/);
  });
});

describe('rejectUnknown', () => {
  it('passes a clean record', () => {
    const record = { a: 1, b: 2 };
    expect(rejectUnknown(record, ['a', 'b', 'c'])).toBe(record);
  });

  it('names the first field it does not know', () => {
    expect(() => rejectUnknown({ a: 1, plasticVicosity: 22 }, ['a'], 'check')).toThrow(
      /check: unknown field plasticVicosity/
    );
  });

  it('is happy with nothing at all', () => {
    expect(rejectUnknown(null, ['a'])).toBe(null);
  });
});

describe('eachRecord', () => {
  it('names the index that failed', () => {
    expect(() =>
      eachRecord([{ ppg: 12 }, { ppg: 'x' }], 'checks', (record, where) =>
        requireNumber(record, 'ppg', where)
      )
    ).toThrow(/checks\[1\].ppg/);
  });

  it('refuses an entry that is not an object', () => {
    expect(() => eachRecord([1], 'checks', () => null)).toThrow(/checks\[0\]: expected an object/);
  });

  it('returns what the reader returns', () => {
    expect(eachRecord([{ ppg: 12 }], 'checks', (record) => record.ppg)).toEqual([12]);
  });
});
