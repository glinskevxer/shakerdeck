import { describe, it, expect } from 'vitest';
import { estimateWell, estimateAgainstActual, overrunBySection } from '../../src/cost/estimate.js';
import { readProgramme } from '../../src/program/window.js';

const programme = readProgramme({
  well: 'brazos 14-3',
  sections: [
    { name: 'surface', fromFeet: 0, toFeet: 6000, holeSizeInches: 12.25, limits: {} },
    { name: 'intermediate', fromFeet: 6000, toFeet: 10450, holeSizeInches: 8.5, limits: {} },
  ],
});

const products = [
  { code: 'BAR', name: 'barite', unit: 'sack', pricePerUnit: 16 },
  { code: 'PAC', name: 'polyanionic cellulose', unit: 'sack', pricePerUnit: 96 },
];
const treatments = [
  { code: 'BAR', perBarrel: 0.6 },
  { code: 'PAC', perBarrel: 0.03 },
];

const estimate = estimateWell({
  programme,
  treatments,
  products,
  surfaceSystemBbl: 500,
  serviceRatePerDay: 1450,
  rentalRatePerDay: 320,
});

describe('estimateWell', () => {
  it('plans every section', () => {
    expect(estimate.sections.map((section) => section.name)).toEqual(['surface', 'intermediate']);
  });

  it('totals the footage', () => {
    expect(estimate.footageFeet).toBe(10450);
  });

  it('adds the day rates on top of the products', () => {
    expect(estimate.serviceCost).toBeGreaterThan(0);
    expect(estimate.baseCost).toBe(
      Math.round((estimate.productCost + estimate.serviceCost + estimate.rentalCost) * 100) / 100
    );
  });

  it('puts contingency on the end', () => {
    expect(estimate.contingency).toBeCloseTo(estimate.baseCost * 0.1, 1);
    expect(estimate.totalCost).toBeGreaterThan(estimate.baseCost);
  });

  it('takes a different contingency', () => {
    const tight = estimateWell({
      programme,
      treatments,
      products,
      surfaceSystemBbl: 500,
      contingencyShare: 0,
    });
    expect(tight.totalCost).toBe(tight.baseCost);
  });

  it('costs more per foot in the bigger hole', () => {
    const [surface, intermediate] = estimate.sections;
    expect(surface.costPerFoot).toBeGreaterThan(intermediate.costPerFoot);
  });

  it('takes fewer days at a higher rate of penetration', () => {
    const fast = estimateWell({
      programme,
      treatments,
      products,
      surfaceSystemBbl: 500,
      serviceRatePerDay: 1450,
      penetrationFeetPerDay: 1200,
    });
    expect(fast.days).toBeLessThan(estimate.days);
    expect(fast.serviceCost).toBeLessThan(estimate.serviceCost);
  });

  it('refuses a section with no hole size on it', () => {
    const vague = readProgramme({
      well: 'x',
      sections: [{ name: 'unknown', fromFeet: 0, toFeet: 1000, limits: {} }],
    });
    expect(() =>
      estimateWell({ programme: vague, treatments, products, surfaceSystemBbl: 500 })
    ).toThrow(/has no hole size/);
  });
});

describe('estimateAgainstActual', () => {
  it('reports an overrun', () => {
    const against = estimateAgainstActual({
      estimate,
      actual: { totalCost: estimate.totalCost * 1.2, footageFeet: 10450 },
    });
    expect(against.verdict).toBe('over the estimate');
    expect(against.overrunShare).toBeCloseTo(0.2, 2);
  });

  it('reports coming in under', () => {
    const against = estimateAgainstActual({
      estimate,
      actual: { totalCost: estimate.totalCost * 0.9, footageFeet: 10450 },
    });
    expect(against.verdict).toBe('inside the estimate');
    expect(against.overrun).toBeLessThan(0);
  });

  it('compares per foot as well as in total', () => {
    const against = estimateAgainstActual({
      estimate,
      actual: { totalCost: estimate.totalCost, footageFeet: 12000 },
    });
    expect(against.actualPerFoot).toBeLessThan(against.estimatedPerFoot);
    expect(against.footageOver).toBe(1550);
  });

  it('refuses actuals with no footage', () => {
    expect(() =>
      estimateAgainstActual({ estimate, actual: { totalCost: 1000, footageFeet: 0 } })
    ).toThrow(/above zero/);
  });
});

describe('overrunBySection', () => {
  it('finds the section that carried the overrun', () => {
    const rows = overrunBySection({
      estimate,
      actualBySection: {
        surface: estimate.sections[0].sectionCost,
        intermediate: estimate.sections[1].sectionCost * 1.5,
      },
    });
    expect(rows[0].name).toBe('intermediate');
    expect(rows[0].share).toBeCloseTo(0.5, 2);
  });

  it('leaves a section with no actuals at the end', () => {
    const rows = overrunBySection({
      estimate,
      actualBySection: { surface: estimate.sections[0].sectionCost * 1.1 },
    });
    expect(rows.at(-1).name).toBe('intermediate');
    expect(rows.at(-1).actual).toBe(null);
  });
});
