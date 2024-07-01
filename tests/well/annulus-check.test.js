import { describe, it, expect } from 'vitest';
import { readAnnulus } from '../../src/well/annulus-check.js';

describe('readAnnulus', () => {
  it('reads a hole and a pipe and reports the gap', () => {
    expect(readAnnulus(8.5, 5)).toEqual({ hole: 8.5, pipe: 5, gap: 3.5 });
  });

  it('allows an empty hole', () => {
    expect(readAnnulus(8.5, 0).gap).toBe(8.5);
  });

  it('refuses an empty hole where a pipe is required', () => {
    expect(() => readAnnulus(8.5, 0, { allowEmpty: false })).toThrow(/above zero/);
  });

  it('refuses a pipe that fills or overfills the hole', () => {
    expect(() => readAnnulus(8.5, 8.5)).toThrow(/a 8.5 inch pipe does not fit in a 8.5 inch hole/);
    expect(() => readAnnulus(8.5, 9.625)).toThrow(/does not fit/);
  });

  it('refuses a hole with no diameter', () => {
    expect(() => readAnnulus(0, 5)).toThrow(/holeIdInches must be above zero/);
  });

  it('words the failure the same way for every caller', () => {
    const first = (() => {
      try {
        readAnnulus(8.5, 9);
      } catch (error) {
        return error.message;
      }
      return null;
    })();
    const second = (() => {
      try {
        readAnnulus(8.5, 9, { allowEmpty: false });
      } catch (error) {
        return error.message;
      }
      return null;
    })();
    expect(first).toBe(second);
  });
});
