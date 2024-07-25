import { describe, it, expect } from 'vitest';
import {
  dayProductCost,
  dayCost,
  costToDate,
  costByCategory,
  sectionCostPerFoot,
} from '../../src/cost/daily.js';

const products = [
  { code: 'BAR', name: 'barite', unit: 'sack', pricePerUnit: 16, category: 'weighting' },
  { code: 'CAU', name: 'caustic soda', unit: 'sack', pricePerUnit: 42, category: 'alkalinity' },
  {
    code: 'PAC',
    name: 'polyanionic cellulose',
    unit: 'sack',
    pricePerUnit: 96,
    category: 'polymer',
  },
];

const days = [
  dayCost({
    date: '2024-09-19',
    products,
    used: { BAR: 260, CAU: 8, PAC: 12 },
    footageFeet: 820,
    mudBuiltBbl: 180,
    serviceCharge: 1450,
    rentalCharge: 320,
  }),
  dayCost({
    date: '2024-09-20',
    products,
    used: { BAR: 140, PAC: 6 },
    footageFeet: 640,
    mudBuiltBbl: 90,
    serviceCharge: 1450,
    rentalCharge: 320,
    haulageCharge: 900,
  }),
];

describe('dayProductCost', () => {
  it('values every line and sorts by cost', () => {
    const cost = dayProductCost({ products, used: { BAR: 260, CAU: 8, PAC: 12 } });
    expect(cost.lines[0].code).toBe('BAR');
    expect(cost.lines[0].value).toBe(4160);
    expect(cost.total).toBe(5648);
  });

  it('carries the category through for the split', () => {
    const cost = dayProductCost({ products, used: { CAU: 8 } });
    expect(cost.lines[0].category).toBe('alkalinity');
  });

  it('is nothing on a day nothing was used', () => {
    expect(dayProductCost({ products, used: {} }).total).toBe(0);
  });

  it('refuses a product that is not on the list', () => {
    expect(() => dayProductCost({ products, used: { XYZ: 1 } })).toThrow(/not on the price list/);
  });
});

describe('dayCost', () => {
  it('adds the service and rental to the products', () => {
    expect(days[0].productCost).toBe(5648);
    expect(days[0].total).toBe(7418);
  });

  it('works both per foot figures out', () => {
    expect(days[0].costPerFoot).toBe(9.05);
    expect(days[0].costPerBarrelBuilt).toBe(41.21);
  });

  it('leaves the per foot figure out on a day nothing was drilled', () => {
    const tripping = dayCost({ date: '2024-09-21', products, used: {}, serviceCharge: 1450 });
    expect(tripping.costPerFoot).toBe(null);
    expect(tripping.costPerBarrelBuilt).toBe(null);
    expect(tripping.total).toBe(1450);
  });

  it('counts haulage where there was any', () => {
    expect(days[1].haulageCharge).toBe(900);
    expect(days[1].total).toBeGreaterThan(days[1].productCost + 1770);
  });
});

describe('costToDate', () => {
  const run = costToDate(days);

  it('carries the cost forward', () => {
    expect(run.days[0].cumulativeCost).toBe(days[0].total);
    expect(run.days[1].cumulativeCost).toBe(days[0].total + days[1].total);
  });

  it('carries the footage forward', () => {
    expect(run.totalFootage).toBe(1460);
  });

  it('works the cost per foot to date out at every step', () => {
    expect(run.days[0].costPerFootToDate).toBe(9.05);
    expect(run.days[1].costPerFootToDate).toBe(run.costPerFoot);
  });

  it('refuses an empty run', () => {
    expect(() => costToDate([])).toThrow(/no days to total/);
  });

  it('leaves the per foot figure out when nothing was drilled at all', () => {
    const tripping = costToDate([
      dayCost({ date: '2024-09-21', products, used: {}, serviceCharge: 1450 }),
    ]);
    expect(tripping.costPerFoot).toBe(null);
  });
});

describe('costByCategory', () => {
  it('splits the spend by what it was for', () => {
    const split = costByCategory(days);
    expect(split[0].category).toBe('weighting');
    expect(split.reduce((total, row) => total + row.share, 0)).toBeCloseTo(1, 2);
  });

  it('is nothing at all when no product was used', () => {
    expect(costByCategory([dayCost({ date: 'x', products, used: {} })])).toEqual([]);
  });
});

describe('sectionCostPerFoot', () => {
  it('divides the section spend by its length', () => {
    expect(sectionCostPerFoot({ costs: [7418, 9236], fromFeet: 9000, toFeet: 10460 })).toBe(11.41);
  });

  it('refuses a section that does not go down', () => {
    expect(() => sectionCostPerFoot({ costs: [100], fromFeet: 10000, toFeet: 9000 })).toThrow(
      /not below/
    );
  });
});
