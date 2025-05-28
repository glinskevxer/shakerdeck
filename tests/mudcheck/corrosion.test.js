import { describe, it, expect } from 'vitest';
import {
  STEEL_DENSITY,
  CORROSION_BANDS,
  corrosionRate,
  pittingRate,
  corrosionBand,
  readCoupon,
  couponRun,
  scavengerDose,
} from '../../src/mudcheck/corrosion.js';

const coupon = {
  serial: 'C-114',
  startGrams: 43.2,
  endGrams: 43.02,
  areaSquareInches: 6.2,
  daysExposed: 9,
};

describe('corrosionRate', () => {
  it('reads a coupon over the days it was down', () => {
    expect(corrosionRate({ lostGrams: 0.18, areaSquareInches: 6.2, daysExposed: 9 })).toBeCloseTo(
      0.4,
      1
    );
  });

  it('is nothing for a coupon that lost nothing', () => {
    expect(corrosionRate({ lostGrams: 0, areaSquareInches: 6.2, daysExposed: 9 })).toBe(0);
  });

  it('halves over twice the days for the same loss', () => {
    expect(corrosionRate({ lostGrams: 0.18, areaSquareInches: 6.2, daysExposed: 18 })).toBeCloseTo(
      corrosionRate({ lostGrams: 0.18, areaSquareInches: 6.2, daysExposed: 9 }) / 2,
      6
    );
  });

  it('refuses a coupon with no area or no time', () => {
    expect(() => corrosionRate({ lostGrams: 0.18, areaSquareInches: 0, daysExposed: 9 })).toThrow(
      /above zero/
    );
    expect(() => corrosionRate({ lostGrams: 0.18, areaSquareInches: 6.2, daysExposed: 0 })).toThrow(
      /above zero/
    );
  });
});

describe('pittingRate', () => {
  it('uses the density of steel', () => {
    expect(STEEL_DENSITY).toBe(0.2836);
  });

  it('turns a weight loss into a thickness', () => {
    expect(pittingRate({ ratePoundsPerSquareFootPerYear: 2 })).toBeCloseTo(48.99, 1);
  });

  it('is nothing for no loss', () => {
    expect(pittingRate({ ratePoundsPerSquareFootPerYear: 0 })).toBe(0);
  });
});

describe('corrosionBand', () => {
  it('names every band', () => {
    expect(CORROSION_BANDS).toHaveLength(5);
    expect(corrosionBand(0.4)).toBe('very low');
    expect(corrosionBand(2)).toBe('low');
    expect(corrosionBand(4)).toBe('moderate');
    expect(corrosionBand(6)).toBe('high');
    expect(corrosionBand(12)).toBe('severe');
  });

  it('takes each band at its upper edge', () => {
    expect(corrosionBand(1)).toBe('very low');
    expect(corrosionBand(2.9)).toBe('low');
  });
});

describe('readCoupon', () => {
  it('reads a coupon end to end', () => {
    const read = readCoupon(coupon);
    expect(read.lostGrams).toBeCloseTo(0.18, 3);
    expect(read.band).toBe('very low');
    expect(read.acceptable).toBe(true);
  });

  it('is not acceptable once the rate climbs', () => {
    expect(readCoupon({ ...coupon, endGrams: 40 }).acceptable).toBe(false);
  });

  it('is not acceptable with pitting however low the rate is', () => {
    const pitted = readCoupon({ ...coupon, pitting: true });
    expect(pitted.band).toBe('very low');
    expect(pitted.acceptable).toBe(false);
  });

  it('defaults the location to where they normally go', () => {
    expect(readCoupon(coupon).location).toBe('kelly');
  });

  it('refuses a coupon that came out heavier', () => {
    expect(() => readCoupon({ ...coupon, endGrams: 44 })).toThrow(/came out heavier/);
  });
});

describe('couponRun', () => {
  const run = couponRun([
    coupon,
    { ...coupon, serial: 'C-115', endGrams: 41.8, location: 'kelly saver sub' },
    { ...coupon, serial: 'C-116', endGrams: 43.15, pitting: true },
  ]);

  it('puts the worst first', () => {
    expect(run.worst.serial).toBe('C-115');
  });

  it('finds the pitting wherever it is', () => {
    expect(run.anyPitting).toBe(true);
  });

  it('calls for treatment when anything is not acceptable', () => {
    expect(run.treat).toBe(true);
    expect(run.allAcceptable).toBe(false);
  });

  it('is happy with a run of clean coupons', () => {
    const clean = couponRun([coupon, { ...coupon, serial: 'C-117' }]);
    expect(clean.treat).toBe(false);
    expect(clean.allAcceptable).toBe(true);
  });

  it('refuses an empty run', () => {
    expect(() => couponRun([])).toThrow(/no coupons to read/);
  });
});

describe('scavengerDose', () => {
  it('doses against the water rather than the whole system', () => {
    const dose = scavengerDose({ oxygenPartsPerMillion: 4, waterBbl: 650 });
    expect(dose.poundsPerBarrel).toBeCloseTo(0.6, 2);
    expect(dose.totalPounds).toBeCloseTo(390, 0);
  });

  it('is nothing with no oxygen in the mud', () => {
    expect(scavengerDose({ oxygenPartsPerMillion: 0, waterBbl: 650 }).totalPounds).toBe(0);
  });

  it('takes a different treatment rate', () => {
    expect(
      scavengerDose({ oxygenPartsPerMillion: 4, waterBbl: 650, scavengerPerPpm: 0.3 }).totalPounds
    ).toBeCloseTo(780, 0);
  });
});
