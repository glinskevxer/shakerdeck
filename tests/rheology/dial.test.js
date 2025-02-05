import { describe, it, expect } from 'vitest';
import {
  SHEAR_RATE_PER_RPM,
  STRESS_PER_DIAL,
  DYNE_PER_DIAL,
  STANDARD_SPEEDS,
  shearRate,
  shearStress,
  shearStressDyne,
  effectiveViscosity,
  readDials,
  dialAt,
  flowCurve,
  hasStandardSet,
} from '../../src/rheology/dial.js';
import { round } from '../../src/util/number.js';

const check = { 600: 64, 300: 42, 200: 33, 100: 23, 6: 6, 3: 5 };

describe('instrument constants', () => {
  it('are the fann 35 r1 b1 f1 values', () => {
    expect(SHEAR_RATE_PER_RPM).toBe(1.7023);
    expect(STRESS_PER_DIAL).toBe(1.0678);
    expect(DYNE_PER_DIAL).toBe(5.11);
    expect(STANDARD_SPEEDS).toEqual([600, 300, 200, 100, 6, 3]);
  });
});

describe('shearRate and shearStress', () => {
  it('turns gearbox speed into a shear rate', () => {
    expect(round(shearRate(600), 2)).toBe(1021.38);
    expect(round(shearRate(300), 2)).toBe(510.69);
    expect(round(shearRate(3), 3)).toBe(5.107);
    expect(shearRate(0)).toBe(0);
  });

  it('turns a dial degree into a shear stress', () => {
    expect(round(shearStress(42), 3)).toBe(44.848);
    expect(round(shearStressDyne(42), 2)).toBe(214.62);
    expect(shearStress(0)).toBe(0);
  });

  it('refuses a negative reading', () => {
    expect(() => shearStress(-1)).toThrow(/not be negative/);
    expect(() => shearRate(-1)).toThrow(/not be negative/);
  });
});

describe('effectiveViscosity', () => {
  it('is the point viscosity at the speed read', () => {
    expect(effectiveViscosity(42, 300)).toBe(42);
    expect(effectiveViscosity(64, 600)).toBe(32);
    expect(round(effectiveViscosity(5, 3), 0)).toBe(500);
  });

  it('refuses a stopped rotor', () => {
    expect(() => effectiveViscosity(42, 0)).toThrow(/above zero/);
  });
});

describe('readDials', () => {
  it('keys the readings by speed', () => {
    const dials = readDials(check);
    expect(dials.get(600)).toBe(64);
    expect(dials.get(3)).toBe(5);
    expect(dials.size).toBe(6);
  });

  it('catches a transposed pair', () => {
    expect(() => readDials({ 600: 40, 300: 42 })).toThrow(/below the 42 at 300 rpm/);
  });

  it('allows two speeds to read the same', () => {
    expect(() => readDials({ 6: 5, 3: 5 })).not.toThrow();
  });

  it('refuses an empty or malformed set', () => {
    expect(() => readDials({})).toThrow(/no dial readings/);
    expect(() => readDials(null)).toThrow(/keyed by speed/);
    expect(() => readDials('600:64')).toThrow(/keyed by speed/);
  });

  it('names the speed of a bad reading', () => {
    expect(() => readDials({ 300: 'x' })).toThrow(/dial at 300 rpm/);
  });
});

describe('dialAt', () => {
  it('pulls one speed out', () => {
    expect(dialAt(check, 300)).toBe(42);
    expect(dialAt(readDials(check), 600)).toBe(64);
  });

  it('says which speed is missing', () => {
    expect(() => dialAt({ 600: 64, 300: 42 }, 3)).toThrow(/no reading at 3 rpm/);
  });
});

describe('flowCurve', () => {
  const curve = flowCurve(check);

  it('reports slowest first', () => {
    expect(curve.map((point) => point.rpm)).toEqual([3, 6, 100, 200, 300, 600]);
  });

  it('carries the rate, the stress and the point viscosity', () => {
    expect(curve.at(-1)).toEqual({
      rpm: 600,
      dial: 64,
      shearRate: 1021.38,
      shearStress: 68.339,
      effectiveViscosity: 32,
    });
  });

  it('shows the mud thinning as it is sheared harder', () => {
    const viscosities = curve.map((point) => point.effectiveViscosity);
    for (let i = 1; i < viscosities.length; i += 1) {
      expect(viscosities[i]).toBeLessThanOrEqual(viscosities[i - 1]);
    }
  });
});

describe('hasStandardSet', () => {
  it('is true for a full six speed check', () => {
    expect(hasStandardSet(check)).toBe(true);
  });

  it('is false when the low speeds were skipped', () => {
    expect(hasStandardSet({ 600: 64, 300: 42 })).toBe(false);
  });
});
