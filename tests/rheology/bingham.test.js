import { describe, it, expect } from 'vitest';
import {
  plasticViscosity,
  yieldPoint,
  apparentViscosity,
  ypPvRatio,
  stressAt,
  gels,
  binghamSummary,
} from '../../src/rheology/bingham.js';
import { readDials } from '../../src/rheology/dial.js';

const check = { 600: 64, 300: 42, 200: 33, 100: 23, 6: 6, 3: 5 };

describe('plasticViscosity', () => {
  it('is the difference between the two top speeds', () => {
    expect(plasticViscosity(check)).toBe(22);
    expect(plasticViscosity(readDials(check))).toBe(22);
  });

  it('needs both speeds', () => {
    expect(() => plasticViscosity({ 600: 64 })).toThrow(/no reading at 300 rpm/);
  });
});

describe('yieldPoint', () => {
  it('is twice the three hundred less the six hundred', () => {
    expect(yieldPoint(check)).toBe(20);
    expect(yieldPoint({ 600: 60, 300: 40 })).toBe(20);
  });

  it('can be zero on a newly mixed water based mud', () => {
    expect(yieldPoint({ 600: 40, 300: 20 })).toBe(0);
  });

  it('can be negative on a mud that has been thinned too hard', () => {
    expect(yieldPoint({ 600: 44, 300: 20 })).toBe(-4);
  });
});

describe('apparentViscosity', () => {
  it('is half the six hundred reading', () => {
    expect(apparentViscosity(check)).toBe(32);
  });
});

describe('ypPvRatio', () => {
  it('reports the carrying ratio', () => {
    expect(ypPvRatio(check)).toBeCloseTo(20 / 22, 10);
  });

  it('refuses to divide by a zero plastic viscosity', () => {
    expect(() => ypPvRatio({ 600: 30, 300: 30 })).toThrow(/no meaning/);
  });
});

describe('stressAt', () => {
  it('returns the yield point at rest', () => {
    expect(stressAt(check, 0)).toBe(20);
  });

  it('meets the three hundred reading at its own shear rate', () => {
    expect(stressAt(check, 511)).toBeCloseTo(42, 10);
  });

  it('is a straight line', () => {
    const a = stressAt(check, 100);
    const b = stressAt(check, 200);
    const c = stressAt(check, 300);
    expect(b - a).toBeCloseTo(c - b, 10);
  });
});

describe('gels', () => {
  it('reads a flat gel', () => {
    const result = gels({ tenSecond: 6, tenMinute: 8 });
    expect(result.tenSecond).toBe(6);
    expect(result.tenMinute).toBe(8);
    expect(result.thirtyMinute).toBe(null);
    expect(result.riseTenToTen).toBe(2);
    expect(result.progressive).toBe(false);
  });

  it('flags a progressive gel', () => {
    expect(gels({ tenSecond: 6, tenMinute: 18 }).progressive).toBe(true);
    expect(gels({ tenSecond: 2, tenMinute: 6 }).progressive).toBe(true);
  });

  it('takes a thirty minute reading when there is one', () => {
    expect(gels({ tenSecond: 6, tenMinute: 9, thirtyMinute: 12 }).thirtyMinute).toBe(12);
  });

  it('refuses a gel that falls with time', () => {
    expect(() => gels({ tenSecond: 9, tenMinute: 6 })).toThrow(/below the ten second gel/);
    expect(() => gels({ tenSecond: 6, tenMinute: 9, thirtyMinute: 7 })).toThrow(
      /below the ten minute gel/
    );
  });

  it('treats a missing ten minute reading as flat', () => {
    expect(gels({ tenSecond: 5 }).tenMinute).toBe(5);
    expect(gels().tenSecond).toBe(0);
  });
});

describe('binghamSummary', () => {
  it('is the block the daily report leads with', () => {
    expect(binghamSummary(check)).toEqual({
      plasticViscosity: 22,
      yieldPoint: 20,
      apparentViscosity: 32,
      ypPvRatio: 0.91,
    });
  });
});
