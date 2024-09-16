import { describe, it, expect } from 'vitest';
import {
  sectionHoleVolume,
  sectionAnnularVolume,
  sectionMudPlan,
  sectionProductPlan,
  sectionPlan,
} from '../../src/program/section.js';

const products = [
  { code: 'BAR', name: 'barite', unit: 'sack', pricePerUnit: 16 },
  { code: 'PAC', name: 'polyanionic cellulose', unit: 'sack', pricePerUnit: 96 },
  { code: 'XCD', name: 'xanthan gum', unit: 'sack', pricePerUnit: 210 },
];

const treatments = [
  { code: 'BAR', perBarrel: 0.6 },
  { code: 'PAC', perBarrel: 0.03 },
  { code: 'XCD', perBarrel: 0.01 },
];

describe('sectionHoleVolume', () => {
  it('reads the hole at gauge', () => {
    expect(sectionHoleVolume({ bitDiameterInches: 8.5, lengthFeet: 4450 }).gaugeBbl).toBe(312.3);
  });

  it('adds the washout', () => {
    const volume = sectionHoleVolume({
      bitDiameterInches: 8.5,
      lengthFeet: 4450,
      washoutFraction: 0.1,
    });
    expect(volume.washedBbl).toBeCloseTo(volume.gaugeBbl * 1.1, 0);
  });

  it('carries the capacity it worked from', () => {
    expect(sectionHoleVolume({ bitDiameterInches: 8.5, lengthFeet: 1 }).capacityBblPerFoot).toBe(
      0.07019
    );
  });
});

describe('sectionAnnularVolume', () => {
  it('is smaller than the hole with a string in it', () => {
    const hole = sectionHoleVolume({ bitDiameterInches: 8.5, lengthFeet: 4450 }).gaugeBbl;
    expect(
      sectionAnnularVolume({ bitDiameterInches: 8.5, pipeOdInches: 5, lengthFeet: 4450 })
    ).toBeLessThan(hole);
  });

  it('refuses a string that does not fit', () => {
    expect(() =>
      sectionAnnularVolume({ bitDiameterInches: 8.5, pipeOdInches: 9, lengthFeet: 4450 })
    ).toThrow(/does not fit/);
  });
});

describe('sectionMudPlan', () => {
  const plan = sectionMudPlan({
    bitDiameterInches: 8.5,
    lengthFeet: 4450,
    surfaceSystemBbl: 500,
  });

  it('counts the hole, the surface system, the dilution and what leaves', () => {
    expect(plan.holeVolumeBbl).toBeGreaterThan(300);
    expect(plan.dilutionBbl).toBeGreaterThan(0);
    expect(plan.lostOnCuttingsBbl).toBeGreaterThan(0);
    expect(plan.totalToBuildBbl).toBeGreaterThan(plan.systemAtTotalDepthBbl);
  });

  it('needs far more dilution with the equipment off', () => {
    const bare = sectionMudPlan({
      bitDiameterInches: 8.5,
      lengthFeet: 4450,
      surfaceSystemBbl: 500,
      removalEfficiency: 0,
    });
    expect(bare.dilutionBbl).toBeGreaterThan(plan.dilutionBbl * 1.8);
  });

  it('needs more mud in a bigger hole', () => {
    const big = sectionMudPlan({
      bitDiameterInches: 12.25,
      lengthFeet: 4450,
      surfaceSystemBbl: 500,
    });
    expect(big.totalToBuildBbl).toBeGreaterThan(plan.totalToBuildBbl);
  });

  it('refuses a system of nothing', () => {
    expect(() =>
      sectionMudPlan({ bitDiameterInches: 8.5, lengthFeet: 4450, surfaceSystemBbl: 0 })
    ).toThrow(/above zero/);
  });
});

describe('sectionProductPlan', () => {
  const plan = sectionMudPlan({
    bitDiameterInches: 8.5,
    lengthFeet: 4450,
    surfaceSystemBbl: 500,
  });
  const order = sectionProductPlan({ plan, treatments, products });

  it('orders whole units off a rate per barrel', () => {
    for (const line of order.lines) {
      expect(Number.isInteger(line.quantity)).toBe(true);
    }
  });

  it('sorts by what each line costs', () => {
    const values = order.lines.map((row) => row.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('totals the order', () => {
    expect(order.total).toBeCloseTo(
      order.lines.reduce((sum, row) => sum + row.value, 0),
      2
    );
  });

  it('refuses a treatment for something not on the price list', () => {
    expect(() =>
      sectionProductPlan({ plan, treatments: [{ code: 'ZZZ', perBarrel: 1 }], products })
    ).toThrow(/not on the price list/);
  });
});

describe('sectionPlan', () => {
  const section = { name: 'intermediate', fromFeet: 6000, toFeet: 10450, holeSizeInches: 8.5 };
  const plan = sectionPlan({ section, treatments, products, surfaceSystemBbl: 500 });

  it('carries the section through', () => {
    expect(plan.name).toBe('intermediate');
    expect(plan.lengthFeet).toBe(4450);
  });

  it('works a cost per foot out', () => {
    expect(plan.costPerFoot).toBeCloseTo(plan.productCost / 4450, 2);
  });

  it('costs more per foot in a bigger hole', () => {
    const big = sectionPlan({
      section: { ...section, holeSizeInches: 12.25 },
      treatments,
      products,
      surfaceSystemBbl: 500,
    });
    expect(big.costPerFoot).toBeGreaterThan(plan.costPerFoot);
  });

  it('refuses a section that does not go down', () => {
    expect(() =>
      sectionPlan({
        section: { ...section, toFeet: 6000 },
        treatments,
        products,
        surfaceSystemBbl: 500,
      })
    ).toThrow(/above zero/);
  });
});
