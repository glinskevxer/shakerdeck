import { describe, it, expect } from 'vitest';
import {
  lowShearYieldPoint,
  herschelFit,
  stressAt,
  viscosityAt,
  residuals,
  worstError,
  herschelSummary,
} from '../../src/rheology/herschel.js';
import { shearRate, shearStress } from '../../src/rheology/dial.js';
import { round } from '../../src/util/number.js';

const check = { 600: 64, 300: 42, 200: 33, 100: 23, 6: 6, 3: 5 };

describe('lowShearYieldPoint', () => {
  it('is twice the three less the six', () => {
    expect(lowShearYieldPoint(check)).toBe(4);
    expect(lowShearYieldPoint({ 6: 9, 3: 7 })).toBe(5);
  });

  it('goes to zero on a mud with no low end structure', () => {
    expect(lowShearYieldPoint({ 6: 4, 3: 2 })).toBe(0);
  });

  it('goes negative when the six is more than twice the three', () => {
    expect(lowShearYieldPoint({ 6: 8, 3: 3 })).toBe(-2);
  });

  it('needs both low speeds', () => {
    expect(() => lowShearYieldPoint({ 3: 5 })).toThrow(/no reading at 6 rpm/);
  });
});

describe('herschelFit', () => {
  const fit = herschelFit(check);

  it('takes the yield stress off the low speeds and applies the spring factor', () => {
    expect(fit.tauZeroDial).toBe(4);
    expect(round(fit.tauZero, 3)).toBe(4.271);
  });

  it('fits the curve above the yield stress', () => {
    expect(round(fit.n, 4)).toBe(0.659);
    expect(round(fit.k, 4)).toBe(0.6663);
  });

  it('sits above the plain power law index, because the yield is out of it', () => {
    expect(fit.n).toBeGreaterThan(0.6077);
  });

  it('passes through both speeds it was fitted to', () => {
    expect(stressAt(fit, shearRate(300))).toBeCloseTo(shearStress(42), 8);
    expect(stressAt(fit, shearRate(600))).toBeCloseTo(shearStress(64), 8);
  });

  it('refuses a mud that reads the same at every speed', () => {
    expect(() => herschelFit({ 600: 22, 300: 22, 6: 22, 3: 22 })).toThrow(
      /yield stress of 22 is at or above/
    );
  });
});

describe('stressAt and viscosityAt', () => {
  const fit = herschelFit(check);

  it('never falls below the yield stress', () => {
    expect(stressAt(fit, 0.001)).toBeGreaterThan(fit.tauZero);
    expect(stressAt(fit, 1)).toBeGreaterThan(fit.tauZero);
  });

  it('predicts the point viscosity', () => {
    expect(round(viscosityAt(fit, 511), 1)).toBe(42);
  });

  it('refuses a zero shear rate', () => {
    expect(() => stressAt(fit, 0)).toThrow(/above zero/);
    expect(() => viscosityAt(fit, -1)).toThrow(/above zero/);
  });
});

describe('residuals', () => {
  const rows = residuals(check);

  it('reports one row per reading', () => {
    expect(rows.map((row) => row.rpm)).toEqual([600, 300, 200, 100, 6, 3]);
  });

  it('is exact at the two speeds it was fitted through', () => {
    expect(rows[0].errorDial).toBe(0);
    expect(rows[1].errorDial).toBe(0);
  });

  it('shows where the three constant fit misses', () => {
    expect(rows[3]).toMatchObject({ rpm: 100, errorDial: -0.58 });
    expect(rows[4]).toMatchObject({ rpm: 6, errorDial: 0.89 });
  });

  it('skips a speed that was not read', () => {
    const partial = residuals({ 600: 64, 300: 42, 6: 6, 3: 5 });
    expect(partial.map((row) => row.rpm)).toEqual([600, 300, 6, 3]);
  });

  it('takes a fit that was worked out already', () => {
    expect(residuals(check, herschelFit(check))).toEqual(rows);
  });
});

describe('worstError', () => {
  it('is the largest miss over the curve', () => {
    expect(worstError(check)).toBe(0.89);
  });
});

describe('herschelSummary', () => {
  it('is the block the rheology page prints', () => {
    expect(herschelSummary(check)).toEqual({
      lowShearYieldPoint: 4,
      tauZero: 4.271,
      n: 0.659,
      k: 0.6663,
      worstErrorDial: 0.89,
    });
  });
});
