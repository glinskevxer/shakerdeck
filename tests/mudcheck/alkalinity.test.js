import { describe, it, expect } from 'vitest';
import {
  HYDROXYL_FACTOR,
  CARBONATE_FACTOR,
  BICARBONATE_FACTOR,
  ionSplit,
  excessLime,
  carbonateProblem,
  gypsumForCarbonate,
  alkalinitySummary,
} from '../../src/mudcheck/alkalinity.js';
import { round } from '../../src/util/number.js';

describe('ionSplit', () => {
  it('uses the api factors', () => {
    expect(HYDROXYL_FACTOR).toBe(340);
    expect(CARBONATE_FACTOR).toBe(1200);
    expect(BICARBONATE_FACTOR).toBe(1220);
  });

  it('reads all bicarbonate when nothing turns the phenolphthalein', () => {
    expect(ionSplit(0, 1.5)).toEqual({
      hydroxylMgL: 0,
      carbonateMgL: 0,
      bicarbonateMgL: 1830,
    });
  });

  it('reads carbonate and bicarbonate when twice pf is under mf', () => {
    expect(ionSplit(0.4, 1.1)).toEqual({
      hydroxylMgL: 0,
      carbonateMgL: 480,
      bicarbonateMgL: 366,
    });
  });

  it('reads pure carbonate when twice pf lands on mf', () => {
    expect(ionSplit(0.5, 1)).toEqual({
      hydroxylMgL: 0,
      carbonateMgL: 600,
      bicarbonateMgL: 0,
    });
  });

  it('reads hydroxyl and carbonate when twice pf is over mf', () => {
    expect(ionSplit(1, 1.2)).toEqual({
      hydroxylMgL: 272,
      carbonateMgL: 240,
      bicarbonateMgL: 0,
    });
  });

  it('reads a caustic filtrate with no carbonate at all', () => {
    expect(ionSplit(1, 1)).toEqual({
      hydroxylMgL: 340,
      carbonateMgL: 0,
      bicarbonateMgL: 0,
    });
  });

  it('refuses a pf above its own mf', () => {
    expect(() => ionSplit(1.5, 1.1)).toThrow(/one of the two titrations is wrong/);
  });

  it('refuses a negative titration', () => {
    expect(() => ionSplit(-1, 2)).toThrow(/not be negative/);
  });
});

describe('excessLime', () => {
  it('works the lime off the whole mud and the filtrate', () => {
    expect(round(excessLime(1.8, 0.4, 0.82), 2)).toBe(0.38);
  });

  it('overstates the lime when the water fraction is left out', () => {
    expect(excessLime(1.8, 0.4)).toBeLessThan(excessLime(1.8, 0.4, 0.82));
    expect(round(excessLime(1.8, 0.4), 2)).toBe(0.36);
  });

  it('reads zero on a mud with no lime left', () => {
    expect(excessLime(0.4, 0.4, 1)).toBe(0);
  });

  it('refuses a water fraction quoted as a percentage', () => {
    expect(() => excessLime(1.8, 0.4, 82)).toThrow(/above one/);
  });
});

describe('carbonateProblem', () => {
  it('is clear on a filtrate with little carbonate', () => {
    expect(carbonateProblem(0.2, 1)).toMatchObject({ level: 'clear', carbonateMgL: 240 });
  });

  it('is worth watching in the middle', () => {
    expect(carbonateProblem(0.5, 1.5).level).toBe('watch');
  });

  it('calls for treatment above a thousand', () => {
    expect(carbonateProblem(1, 3)).toMatchObject({ level: 'treat', carbonateMgL: 1200 });
  });

  it('takes each band at its lower edge', () => {
    expect(carbonateProblem(500 / 1200, 2).level).toBe('watch');
    expect(carbonateProblem(1000 / 1200, 3).level).toBe('treat');
  });
});

describe('gypsumForCarbonate', () => {
  it('works a treatment out in pounds per barrel', () => {
    expect(round(gypsumForCarbonate(1200, 0.82), 3)).toBe(26.243);
  });

  it('is zero when there is no carbonate', () => {
    expect(gypsumForCarbonate(0, 0.82)).toBe(0);
  });

  it('scales with the water in the mud', () => {
    expect(gypsumForCarbonate(1200, 0.5)).toBeLessThan(gypsumForCarbonate(1200, 0.9));
  });
});

describe('alkalinitySummary', () => {
  it('is the alkalinity block of the report', () => {
    expect(alkalinitySummary({ pf: 0.4, mf: 1.1, pm: 1.8 }, 0.82)).toEqual({
      pf: 0.4,
      mf: 1.1,
      pm: 1.8,
      hydroxylMgL: 0,
      carbonateMgL: 480,
      bicarbonateMgL: 366,
      excessLimeLbBbl: 0.38,
      carbonateLevel: 'clear',
    });
  });

  it('leaves the lime out when no whole mud titration was run', () => {
    expect(alkalinitySummary({ pf: 0.4, mf: 1.1, pm: null }).excessLimeLbBbl).toBe(null);
  });

  it('is nothing at all when the filtrate was not titrated', () => {
    expect(alkalinitySummary(null)).toBe(null);
    expect(alkalinitySummary({ pf: null, mf: null })).toBe(null);
    expect(alkalinitySummary({ pf: 0.4, mf: null })).toBe(null);
  });
});
