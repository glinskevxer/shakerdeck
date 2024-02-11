import { describe, it, expect } from 'vitest';
import {
  WATER_PPG,
  PCF_PER_PPG,
  GRADIENT_PER_PPG,
  ppgToSg,
  sgToPpg,
  ppgToPcf,
  pcfToPpg,
  ppgToGradient,
  gradientToPpg,
  hydrostatic,
  equivalentWeight,
  pressureGradientToPpg,
  describeDensity,
} from '../../src/units/density.js';
import { round } from '../../src/util/number.js';

describe('density constants', () => {
  it('uses the api values', () => {
    expect(WATER_PPG).toBeCloseTo(8.3454, 4);
    expect(PCF_PER_PPG).toBeCloseTo(7.480519, 6);
    expect(GRADIENT_PER_PPG).toBe(0.052);
  });
});

describe('ppg and specific gravity', () => {
  it('reads fresh water as one', () => {
    expect(ppgToSg(WATER_PPG)).toBeCloseTo(1, 10);
    expect(sgToPpg(1)).toBeCloseTo(WATER_PPG, 10);
  });

  it('converts a working mud weight', () => {
    expect(round(ppgToSg(12.5), 3)).toBe(1.498);
    expect(round(sgToPpg(1.5), 2)).toBe(12.52);
  });

  it('round trips', () => {
    expect(sgToPpg(ppgToSg(14.2))).toBeCloseTo(14.2, 10);
  });

  it('refuses a weightless mud', () => {
    expect(() => ppgToSg(0)).toThrow(/above zero/);
    expect(() => sgToPpg(-1)).toThrow(/above zero/);
  });
});

describe('ppg and pounds per cubic foot', () => {
  it('converts both ways', () => {
    expect(round(ppgToPcf(10), 2)).toBe(74.81);
    expect(round(pcfToPpg(74.805), 2)).toBe(10);
  });

  it('round trips', () => {
    expect(pcfToPpg(ppgToPcf(16.4))).toBeCloseTo(16.4, 10);
  });
});

describe('pressure gradient', () => {
  it('uses the rig constant by default', () => {
    expect(ppgToGradient(10)).toBeCloseTo(0.52, 10);
    expect(round(ppgToGradient(9.6), 4)).toBe(0.4992);
  });

  it('offers the unrounded constant', () => {
    expect(round(ppgToGradient(10, { exact: true }), 5)).toBe(0.51948);
  });

  it('converts a gradient back to a mud weight', () => {
    expect(round(gradientToPpg(0.52), 2)).toBe(10);
    expect(round(pressureGradientToPpg(0.465), 2)).toBe(8.94);
  });
});

describe('hydrostatic', () => {
  it('is the head of the column at true vertical depth', () => {
    expect(hydrostatic(10, 10000)).toBeCloseTo(5200, 6);
    expect(round(hydrostatic(12.6, 8450), 0)).toBe(5536);
  });

  it('is zero at surface', () => {
    expect(hydrostatic(12, 0)).toBe(0);
  });

  it('inverts to an equivalent mud weight', () => {
    expect(round(equivalentWeight(5200, 10000), 2)).toBe(10);
    expect(round(equivalentWeight(4800, 9000), 2)).toBe(10.26);
  });

  it('refuses a zero depth on the inverse', () => {
    expect(() => equivalentWeight(4800, 0)).toThrow(/above zero/);
  });
});

describe('describeDensity', () => {
  it('fills in every unit for a report line', () => {
    expect(describeDensity(11.8)).toEqual({
      ppg: 11.8,
      sg: 1.414,
      pcf: 88.3,
      gradientPsiPerFoot: 0.6136,
    });
  });

  it('honours a wider decimal request', () => {
    expect(describeDensity(11.856, 3).ppg).toBe(11.856);
  });
});
