import { describe, it, expect } from 'vitest';
import {
  CHLORIDE_EQUIVALENT,
  HARDNESS_FACTOR,
  SALT_PER_CHLORIDE,
  MG_PER_LITRE_TO_LB_PER_BBL,
  chloride,
  saltFromChloride,
  saltPercent,
  saltLbPerBblWater,
  totalHardness,
  sodaAshForCalcium,
  describeHardness,
  waterPhaseSalinity,
  chemistrySummary,
} from '../../src/mudcheck/titration.js';
import { round } from '../../src/util/number.js';

describe('chloride', () => {
  it('uses the equivalent weight of chloride', () => {
    expect(CHLORIDE_EQUIVALENT).toBe(35450);
    expect(HARDNESS_FACTOR).toBe(400);
    expect(SALT_PER_CHLORIDE).toBe(1.65);
    expect(MG_PER_LITRE_TO_LB_PER_BBL).toBe(0.00035);
  });

  it('reads a fresh mud on the weak silver nitrate', () => {
    expect(round(chloride(3.2, 1, 0.0282), 0)).toBe(3199);
  });

  it('reads a salt mud on the strong silver nitrate', () => {
    expect(round(chloride(32, 1, 0.282), 0)).toBe(319901);
  });

  it('is an order of magnitude out when the wrong bottle is used', () => {
    expect(chloride(32, 1, 0.282) / chloride(32, 1, 0.0282)).toBeCloseTo(10, 6);
  });

  it('divides by a sample bigger than a millilitre', () => {
    expect(chloride(6.4, 2, 0.0282)).toBeCloseTo(chloride(3.2, 1, 0.0282), 9);
  });

  it('reads zero on a titration that took no silver', () => {
    expect(chloride(0)).toBe(0);
  });

  it('refuses a zero sample or a zero strength', () => {
    expect(() => chloride(3.2, 0)).toThrow(/above zero/);
    expect(() => chloride(3.2, 1, 0)).toThrow(/above zero/);
  });
});

describe('salt', () => {
  it('weighs the salt from the chloride', () => {
    expect(saltFromChloride(32000)).toBe(52800);
  });

  it('reads the percentage by weight of the water phase', () => {
    expect(round(saltPercent(32000), 2)).toBe(5.28);
  });

  it('reads the percentage lower on a heavier filtrate', () => {
    expect(round(saltPercent(32000, 1.03), 2)).toBe(5.13);
    expect(saltPercent(32000, 1.03)).toBeLessThan(saltPercent(32000));
  });

  it('gives the mixing order a weight per barrel', () => {
    expect(round(saltLbPerBblWater(32000), 2)).toBe(18.48);
  });
});

describe('totalHardness', () => {
  it('reads calcium off the edta burette', () => {
    expect(totalHardness(1)).toBe(400);
    expect(totalHardness(2.5)).toBe(1000);
  });

  it('divides by a larger sample', () => {
    expect(totalHardness(5, 5)).toBe(400);
  });

  it('takes a different standard solution', () => {
    expect(totalHardness(1, 1, 20)).toBe(20);
  });
});

describe('sodaAshForCalcium', () => {
  it('works out a treatment in pounds per barrel', () => {
    expect(round(sodaAshForCalcium(400, 0.82), 2)).toBe(12.77);
  });

  it('is zero on water with no calcium in it', () => {
    expect(sodaAshForCalcium(0, 0.82)).toBe(0);
  });

  it('refuses a water fraction quoted as a percentage', () => {
    expect(() => sodaAshForCalcium(400, 82)).toThrow(/above one/);
  });
});

describe('describeHardness', () => {
  it('puts a word to the calcium', () => {
    expect(describeHardness(20)).toBe('soft');
    expect(describeHardness(80)).toBe('moderately hard');
    expect(describeHardness(200)).toBe('hard');
    expect(describeHardness(400)).toBe('very hard');
  });

  it('takes each band at its lower edge', () => {
    expect(describeHardness(60)).toBe('moderately hard');
    expect(describeHardness(120)).toBe('hard');
    expect(describeHardness(240)).toBe('very hard');
  });
});

describe('waterPhaseSalinity', () => {
  it('puts the chloride back over the water the retort found', () => {
    expect(waterPhaseSalinity(32000, 20)).toBe(160000);
  });

  it('is the same number when the mud is all water', () => {
    expect(waterPhaseSalinity(32000, 100)).toBe(32000);
  });

  it('refuses an impossible retort reading', () => {
    expect(() => waterPhaseSalinity(32000, 0)).toThrow(/above zero/);
    expect(() => waterPhaseSalinity(32000, 140)).toThrow(/cannot read 140 percent/);
  });
});

describe('chemistrySummary', () => {
  it('is the chemistry block of the report', () => {
    expect(chemistrySummary({ chlorideMgL: 32000, totalHardnessMgL: 400 })).toEqual({
      chlorideMgL: 32000,
      saltMgL: 52800,
      saltPercentByWeight: 5.28,
      totalHardnessMgL: 400,
      hardness: 'very hard',
    });
  });

  it('leaves the hardness out when it was not run', () => {
    const summary = chemistrySummary({ chlorideMgL: 32000 });
    expect(summary.totalHardnessMgL).toBe(null);
    expect(summary.hardness).toBe(null);
  });

  it('is nothing at all when the chloride was not run', () => {
    expect(chemistrySummary({})).toBe(null);
    expect(chemistrySummary({ chlorideMgL: null })).toBe(null);
  });
});
