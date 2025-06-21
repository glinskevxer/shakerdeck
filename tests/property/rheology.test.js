import { describe, it, expect } from 'vitest';
import { readDials, shearRate, shearStress, STRESS_PER_DIAL } from '../../src/rheology/dial.js';
import {
  plasticViscosity,
  yieldPoint,
  stressAt as binghamStress,
} from '../../src/rheology/bingham.js';
import { powerLawFrom, stressAt as powerStress, viscosityAt } from '../../src/rheology/powerlaw.js';
import {
  herschelFit,
  stressAt as herschelStress,
  lowShearYieldPoint,
} from '../../src/rheology/herschel.js';
import { compareModels, bestModel } from '../../src/rheology/compare.js';
import { reynoldsPipe, frictionFactor, criticalReynolds } from '../../src/hydraulics/reynolds.js';

/**
 * A deterministic generator, so a failure can be reproduced from its seed.
 */
function generator(seed) {
  let state = seed;
  return (low, high) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return low + (state / 2147483648) * (high - low);
  };
}

/**
 * A plausible six speed check: monotonic and shear thinning.
 */
function dialSet(next) {
  const three = Math.round(next(2, 14));
  const six = Math.round(next(three, three * 1.6));
  const hundred = Math.round(next(six + 2, six * 4 + 8));
  const twoHundred = Math.round(next(hundred + 1, hundred * 1.6));
  const threeHundred = Math.round(next(twoHundred + 1, twoHundred * 1.5));
  const sixHundred = Math.round(next(threeHundred + 1, threeHundred * 1.9));
  return { 600: sixHundred, 300: threeHundred, 200: twoHundred, 100: hundred, 6: six, 3: three };
}

describe('any plausible set of dial readings', () => {
  const next = generator(1009);
  const sets = Array.from({ length: 300 }, () => dialSet(next));

  it('reads without complaint', () => {
    for (const dials of sets) {
      expect(() => readDials(dials)).not.toThrow();
    }
  });

  it('gives a plastic viscosity that is never negative', () => {
    for (const dials of sets) {
      expect(plasticViscosity(dials)).toBeGreaterThanOrEqual(0);
    }
  });

  it('splits the three hundred reading exactly between pv and yp', () => {
    for (const dials of sets) {
      expect(plasticViscosity(dials) + yieldPoint(dials)).toBe(dials[300]);
    }
  });

  it('fits a power law that passes through both its readings', () => {
    for (const dials of sets) {
      const fit = powerLawFrom(dials, 600, 300);
      expect(powerStress(fit, shearRate(600))).toBeCloseTo(shearStress(dials[600]), 6);
      expect(powerStress(fit, shearRate(300))).toBeCloseTo(shearStress(dials[300]), 6);
    }
  });

  it('fits an index between zero and two', () => {
    for (const dials of sets) {
      const fit = powerLawFrom(dials, 600, 300);
      expect(fit.n).toBeGreaterThan(0);
      expect(fit.n).toBeLessThan(2);
    }
  });

  it('predicts a viscosity that falls as the shear rate climbs, whenever it thins', () => {
    for (const dials of sets) {
      const fit = powerLawFrom(dials, 600, 300);
      if (fit.n >= 1) {
        continue;
      }
      expect(viscosityAt(fit, 1000)).toBeLessThan(viscosityAt(fit, 100));
    }
  });

  it('never puts the bingham line below the yield point', () => {
    for (const dials of sets) {
      expect(binghamStress(dials, 0)).toBe(yieldPoint(dials));
      expect(binghamStress(dials, 500)).toBeGreaterThanOrEqual(yieldPoint(dials));
    }
  });

  it('fits herschel bulkley wherever the low end allows it', () => {
    for (const dials of sets) {
      if (lowShearYieldPoint(dials) >= dials[300]) {
        continue;
      }
      const fit = herschelFit(dials);
      expect(herschelStress(fit, shearRate(600))).toBeCloseTo(shearStress(dials[600]), 6);
      expect(fit.tauZero).toBeCloseTo(fit.tauZeroDial * STRESS_PER_DIAL, 9);
    }
  });

  it('always picks the model with the smallest spread over the readings', () => {
    for (const dials of sets) {
      const rows = compareModels(dials);
      const smallest = Math.min(...rows.map((row) => row.rootMeanSquare));
      expect(bestModel(dials).rootMeanSquare).toBe(smallest);
    }
  });

  it('picks a curved fit far more often than the straight line', () => {
    const picks = sets.map((dials) => bestModel(dials).model);
    const straight = picks.filter((model) => model === 'bingham').length;
    expect(straight / picks.length).toBeLessThan(0.35);
  });

  it('scores every model it fitted, and none of them worse than the readings allow', () => {
    for (const dials of sets) {
      for (const row of compareModels(dials)) {
        expect(row.rootMeanSquare).toBeGreaterThanOrEqual(0);
        expect(row.readings).toBe(6);
      }
    }
  });

  it('always names a best model that is one of the ones it scored', () => {
    for (const dials of sets) {
      const rows = compareModels(dials);
      expect(rows.map((row) => row.model)).toContain(bestModel(dials).model);
    }
  });
});

describe('any plausible flow through drill pipe', () => {
  const next = generator(2027);

  it('never produces a friction factor at or below zero', () => {
    for (let i = 0; i < 300; i += 1) {
      const dials = dialSet(next);
      const fit = powerLawFrom(dials, 600, 300);
      const re = reynoldsPipe({
        densityPpg: next(8.4, 18),
        velocityFeetPerSecond: next(1, 30),
        idInches: next(2, 6),
        model: fit,
      });
      const factor = frictionFactor(re, fit.n);
      expect(factor).toBeGreaterThan(0);
      expect(factor).toBeLessThan(1);
    }
  });

  it('always puts the turbulent threshold above the laminar one', () => {
    for (let i = 0; i < 300; i += 1) {
      const n = next(0.2, 1.4);
      const { laminarUpTo, turbulentFrom } = criticalReynolds(n);
      expect(turbulentFrom).toBeGreaterThan(laminarUpTo);
      expect(turbulentFrom - laminarUpTo).toBeCloseTo(800, 6);
    }
  });

  it('never reports a reynolds number below zero', () => {
    for (let i = 0; i < 200; i += 1) {
      const dials = dialSet(next);
      const re = reynoldsPipe({
        densityPpg: next(8.4, 18),
        velocityFeetPerSecond: next(0, 40),
        idInches: next(2, 6),
        model: powerLawFrom(dials, 600, 300),
      });
      expect(re).toBeGreaterThanOrEqual(0);
    }
  });
});
