import { describe, it, expect } from 'vitest';
import {
  BARITE_SG,
  LOW_GRAVITY_SG,
  POUNDS_PER_BARREL_WATER,
  BASE_OIL_SG,
  solidWeight,
  averageSolidsSg,
  soliditySplit,
  drilledSolids,
  drilledToBentoniteRatio,
  solidsSummary,
} from '../../src/solids/analysis.js';
import { round } from '../../src/util/number.js';

const weighted = { weightPpg: 12.4, solidsPercent: 18, waterPercent: 82 };

describe('solidWeight', () => {
  it('uses the barrel of water constant', () => {
    expect(POUNDS_PER_BARREL_WATER).toBe(350);
    expect(BARITE_SG).toBe(4.2);
    expect(LOW_GRAVITY_SG).toBe(2.6);
    expect(BASE_OIL_SG).toBe(0.84);
  });

  it('weighs a volume percent of barite', () => {
    expect(solidWeight(BARITE_SG, 10)).toBeCloseTo(147, 6);
  });

  it('weighs a volume percent of drilled solids', () => {
    expect(solidWeight(LOW_GRAVITY_SG, 10)).toBeCloseTo(91, 6);
  });

  it('is zero at no volume', () => {
    expect(solidWeight(BARITE_SG, 0)).toBe(0);
  });
});

describe('averageSolidsSg', () => {
  it('reads a weighted water based mud', () => {
    expect(round(averageSolidsSg(weighted), 3)).toBe(3.699);
  });

  it('reads an unweighted mud down near the gravity of shale', () => {
    expect(averageSolidsSg({ weightPpg: 9.2, solidsPercent: 5, waterPercent: 95 })).toBeGreaterThan(
      2.6
    );
    expect(averageSolidsSg({ weightPpg: 9.2, solidsPercent: 5, waterPercent: 95 })).toBeLessThan(
      4.2
    );
  });

  it('takes the oil and the brine density on an invert', () => {
    const sg = averageSolidsSg({
      weightPpg: 14.5,
      solidsPercent: 28,
      oilPercent: 52,
      waterPercent: 20,
      brineSg: 1.15,
    });
    expect(round(sg, 3)).toBe(3.824);
  });

  it('reads the gravity high when the brine is taken as fresh', () => {
    const withBrine = averageSolidsSg({
      weightPpg: 14.5,
      solidsPercent: 28,
      oilPercent: 52,
      waterPercent: 20,
      brineSg: 1.15,
    });
    const asFresh = averageSolidsSg({
      weightPpg: 14.5,
      solidsPercent: 28,
      oilPercent: 52,
      waterPercent: 20,
    });
    expect(asFresh).toBeGreaterThan(withBrine);
  });

  it('refuses a retort that does not add up', () => {
    expect(() => averageSolidsSg({ weightPpg: 12.4, solidsPercent: 18, waterPercent: 70 })).toThrow(
      /adds up to 88 percent/
    );
  });

  it('refuses a mud with no solids in it at all', () => {
    expect(() => averageSolidsSg({ weightPpg: 8.4, solidsPercent: 0, waterPercent: 100 })).toThrow(
      /above zero/
    );
  });
});

describe('soliditySplit', () => {
  const split = soliditySplit({ ...weighted });

  it('places the solids between barite and clay', () => {
    expect(split.averageSg).toBe(3.699);
    expect(split.highGravityPercent).toBe(12.37);
    expect(split.lowGravityPercent).toBe(5.63);
  });

  it('weighs each fraction per barrel', () => {
    expect(split.bariteLbBbl).toBe(181.8);
    expect(split.lowGravityLbBbl).toBe(51.3);
  });

  it('adds back up to the retort solids', () => {
    expect(split.highGravityPercent + split.lowGravityPercent).toBeCloseTo(18, 2);
  });

  it('flags a split that came out impossible', () => {
    const wrong = soliditySplit({ weightPpg: 16, solidsPercent: 12, waterPercent: 88 });
    expect(wrong.negativeLowGravity).toBe(true);
    expect(wrong.lowGravityLbBbl).toBe(0);
  });

  it('flags a mud too light for the solids it is carrying', () => {
    const light = soliditySplit({ weightPpg: 8.9, solidsPercent: 12, waterPercent: 88 });
    expect(light.negativeHighGravity).toBe(true);
    expect(light.bariteLbBbl).toBe(0);
  });
});

describe('drilledSolids', () => {
  it('takes the clay that was mixed in off the low gravity fraction', () => {
    const drilled = drilledSolids(5.63, 17.5);
    expect(drilled.bentonitePercent).toBe(1.92);
    expect(drilled.drilledPercent).toBe(3.71);
    expect(drilled.drilledLbBbl).toBe(33.7);
  });

  it('reads the whole low gravity fraction as drilled when no clay was mixed', () => {
    expect(drilledSolids(5.63).drilledPercent).toBe(5.63);
  });

  it('reports a negative fraction rather than throwing on it', () => {
    expect(drilledSolids(-2, 0).drilledPercent).toBe(-2);
    expect(drilledSolids(-2, 0).drilledLbBbl).toBe(0);
  });

  it('refuses a negative clay reading', () => {
    expect(() => drilledSolids(5.63, -1)).toThrow(/not be negative/);
  });
});

describe('drilledToBentoniteRatio', () => {
  it('is the ratio the shakers are judged on', () => {
    expect(round(drilledToBentoniteRatio(3.71, 1.92), 2)).toBe(1.93);
  });

  it('has no meaning with no clay in the mud', () => {
    expect(drilledToBentoniteRatio(3.71, 0)).toBe(null);
  });

  it('reads a negative drilled fraction as none', () => {
    expect(drilledToBentoniteRatio(-1, 2)).toBe(0);
  });
});

describe('solidsSummary', () => {
  it('is the solids block of the report', () => {
    expect(solidsSummary({ ...weighted, bentoniteLbBbl: 17.5 })).toEqual({
      solidsPercent: 18,
      averageSg: 3.699,
      highGravityPercent: 12.37,
      lowGravityPercent: 5.63,
      bariteLbBbl: 181.8,
      lowGravityLbBbl: 51.3,
      negativeHighGravity: false,
      negativeLowGravity: false,
      bentonitePercent: 1.92,
      drilledPercent: 3.71,
      drilledLbBbl: 33.7,
      drilledToBentonite: 1.93,
    });
  });

  it('leaves the ratio out when there is no clay reading', () => {
    expect(solidsSummary(weighted).drilledToBentonite).toBe(null);
  });
});
