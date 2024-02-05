import { describe, it, expect } from 'vitest';
import {
  ValueError,
  toNumber,
  toNonNegative,
  toPositive,
  toCount,
  round,
  clamp,
  sum,
  mean,
  near,
  divide,
  interpolate,
} from '../../src/util/number.js';

describe('toNumber', () => {
  it('passes a finite number through', () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber(-3)).toBe(-3);
    expect(toNumber(0)).toBe(0);
  });

  it('parses a decimal string from a tally sheet', () => {
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber('  9.60  ')).toBe(9.6);
    expect(toNumber('.5')).toBe(0.5);
    expect(toNumber('1e3')).toBe(1000);
  });

  it('rejects a blank cell rather than reading it as zero', () => {
    expect(() => toNumber('', 'mud weight')).toThrow(/mud weight is blank/);
    expect(() => toNumber('   ', 'mud weight')).toThrow(/blank/);
  });

  it('rejects text and stray units', () => {
    expect(() => toNumber('12 ppg', 'density')).toThrow(/not a number/);
    expect(() => toNumber('n/a')).toThrow(ValueError);
    expect(() => toNumber('--5')).toThrow(ValueError);
  });

  it('rejects a non finite number', () => {
    expect(() => toNumber(Number.NaN)).toThrow(/not a finite number/);
    expect(() => toNumber(Number.POSITIVE_INFINITY)).toThrow(/not a finite number/);
  });

  it('rejects anything that is not a number or a string', () => {
    expect(() => toNumber(null, 'pv')).toThrow(/pv is not a number/);
    expect(() => toNumber(undefined)).toThrow(ValueError);
    expect(() => toNumber({}, 'yp')).toThrow(/yp/);
    expect(() => toNumber([1])).toThrow(ValueError);
    expect(() => toNumber(true)).toThrow(ValueError);
  });

  it('names the field on the error object', () => {
    try {
      toNumber('x', 'chlorides');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValueError);
      expect(err.field).toBe('chlorides');
      expect(err.name).toBe('ValueError');
    }
  });
});

describe('toNonNegative and toPositive', () => {
  it('accepts zero only where zero is meaningful', () => {
    expect(toNonNegative(0)).toBe(0);
    expect(() => toPositive(0, 'depth')).toThrow(/depth must be above zero/);
  });

  it('rejects a negative reading', () => {
    expect(() => toNonNegative(-0.1, 'sand')).toThrow(/sand must not be negative/);
    expect(() => toPositive(-4, 'flow')).toThrow(/above zero/);
  });

  it('carries the parse rules through', () => {
    expect(toNonNegative('7.25')).toBe(7.25);
    expect(toPositive('7.25')).toBe(7.25);
    expect(() => toNonNegative('', 'gel')).toThrow(/blank/);
  });
});

describe('toCount', () => {
  it('accepts a whole count', () => {
    expect(toCount(0)).toBe(0);
    expect(toCount('48', 'sacks')).toBe(48);
  });

  it('refuses to truncate a fraction', () => {
    expect(() => toCount(3.5, 'sacks')).toThrow(/whole number/);
  });

  it('refuses a negative count', () => {
    expect(() => toCount(-1, 'sacks')).toThrow(/must not be negative/);
  });
});

describe('round', () => {
  it('rounds half away from zero', () => {
    expect(round(2.5, 0)).toBe(3);
    expect(round(3.5, 0)).toBe(4);
    expect(round(-2.5, 0)).toBe(-3);
  });

  it('holds up on values that float badly', () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(8.615, 2)).toBe(8.62);
    expect(round(0.615, 2)).toBe(0.62);
    expect(round(1.0049999, 2)).toBe(1.0);
  });

  it('defaults to two decimals', () => {
    expect(round(12.3456)).toBe(12.35);
  });

  it('rejects a silly decimal count', () => {
    expect(() => round(1, -1)).toThrow(/decimals/);
    expect(() => round(1, 13)).toThrow(/decimals/);
    expect(() => round(1, 1.5)).toThrow(/decimals/);
  });
});

describe('clamp', () => {
  it('holds a value inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(12, 0, 10)).toBe(10);
  });

  it('rejects an inverted range', () => {
    expect(() => clamp(5, 10, 0)).toThrow(/low must not exceed high/);
  });
});

describe('sum and mean', () => {
  it('adds a list of readings', () => {
    expect(sum([1, 2, 3.5])).toBe(6.5);
    expect(sum([])).toBe(0);
  });

  it('names the offending element', () => {
    expect(() => sum([1, 'x', 3], 'dials')).toThrow(/dials\[1\]/);
  });

  it('rejects a non list', () => {
    expect(() => sum('123', 'dials')).toThrow(/must be a list/);
  });

  it('averages, and refuses an empty list', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(() => mean([], 'checks')).toThrow(/at least one reading/);
    expect(() => mean(null)).toThrow(ValueError);
  });
});

describe('near', () => {
  it('compares within a tolerance', () => {
    expect(near(1.0, 1.0000000001)).toBe(true);
    expect(near(1.0, 1.1)).toBe(false);
    expect(near(1.0, 1.05, 0.1)).toBe(true);
  });
});

describe('divide', () => {
  it('divides', () => {
    expect(divide(10, 4)).toBe(2.5);
  });

  it('names the zero divisor instead of returning infinity', () => {
    expect(() => divide(10, 0, 'annular area')).toThrow(/annular area is zero/);
  });
});

describe('interpolate', () => {
  it('interpolates between two points', () => {
    expect(interpolate(5, 0, 0, 10, 100)).toBe(50);
    expect(interpolate(2.5, 0, 10, 5, 20)).toBe(15);
  });

  it('extrapolates past the ends', () => {
    expect(interpolate(15, 0, 0, 10, 100)).toBe(150);
    expect(interpolate(-5, 0, 0, 10, 100)).toBe(-50);
  });

  it('refuses a zero width interval', () => {
    expect(() => interpolate(1, 4, 0, 4, 9)).toThrow(/same point/);
  });
});
