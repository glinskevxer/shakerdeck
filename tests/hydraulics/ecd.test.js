import { describe, it, expect } from 'vitest';
import {
  equivalentCirculatingDensity,
  cuttingsLoading,
  circulatingDensity,
  fractureMargin,
  poreMargin,
  densityWindow,
} from '../../src/hydraulics/ecd.js';
import { round } from '../../src/util/number.js';

describe('equivalentCirculatingDensity', () => {
  it('adds the annular friction to the mud weight', () => {
    expect(
      round(
        equivalentCirculatingDensity({
          weightPpg: 12.4,
          annularLossPsi: 336.1,
          tvdFeet: 10000,
        }),
        3
      )
    ).toBe(13.046);
  });

  it('is the mud weight with the pump off', () => {
    expect(
      equivalentCirculatingDensity({ weightPpg: 12.4, annularLossPsi: 0, tvdFeet: 10000 })
    ).toBe(12.4);
  });

  it('matters far more in a shallow hole', () => {
    const shallow = equivalentCirculatingDensity({
      weightPpg: 12.4,
      annularLossPsi: 336.1,
      tvdFeet: 3000,
    });
    expect(shallow).toBeGreaterThan(14);
  });

  it('refuses a hole with no depth', () => {
    expect(() =>
      equivalentCirculatingDensity({ weightPpg: 12.4, annularLossPsi: 336, tvdFeet: 0 })
    ).toThrow(/above zero/);
  });
});

describe('cuttingsLoading', () => {
  it('reads a normal rate of penetration as almost nothing', () => {
    const loading = cuttingsLoading({
      penetrationFeetPerHour: 60,
      bitDiameterInches: 8.5,
      flowGpm: 600,
      weightPpg: 12.4,
    });
    expect(loading.volumeFraction).toBe(0.00489);
    expect(loading.addedPpg).toBe(0.045);
  });

  it('climbs when the hole is drilled fast on a slow pump', () => {
    const hard = cuttingsLoading({
      penetrationFeetPerHour: 200,
      bitDiameterInches: 12.25,
      flowGpm: 300,
      weightPpg: 10,
    });
    expect(hard.addedPpg).toBeGreaterThan(0.5);
  });

  it('is nothing when the bit is off bottom', () => {
    expect(
      cuttingsLoading({
        penetrationFeetPerHour: 0,
        bitDiameterInches: 8.5,
        flowGpm: 600,
        weightPpg: 12.4,
      }).addedPpg
    ).toBe(0);
  });

  it('subtracts weight on a mud heavier than the cuttings', () => {
    const heavy = cuttingsLoading({
      penetrationFeetPerHour: 60,
      bitDiameterInches: 8.5,
      flowGpm: 600,
      weightPpg: 22,
    });
    expect(heavy.addedPpg).toBeLessThan(0);
  });

  it('refuses a stopped pump', () => {
    expect(() =>
      cuttingsLoading({
        penetrationFeetPerHour: 60,
        bitDiameterInches: 8.5,
        flowGpm: 0,
        weightPpg: 12.4,
      })
    ).toThrow(/above zero/);
  });
});

describe('circulatingDensity', () => {
  it('splits the density between mud, friction and cuttings', () => {
    expect(
      circulatingDensity({
        weightPpg: 12.4,
        annularLossPsi: 336.1,
        tvdFeet: 10000,
        cuttings: { penetrationFeetPerHour: 60, bitDiameterInches: 8.5, flowGpm: 600 },
      })
    ).toEqual({
      weightPpg: 12.4,
      frictionPpg: 0.646,
      cuttingsPpg: 0.045,
      ecdPpg: 13.09,
      bottomHolePsi: 6808,
    });
  });

  it('leaves the cuttings out when nothing is being drilled', () => {
    const off = circulatingDensity({ weightPpg: 12.4, annularLossPsi: 336.1, tvdFeet: 10000 });
    expect(off.cuttingsPpg).toBe(0);
    expect(off.ecdPpg).toBe(13.05);
  });
});

describe('fractureMargin', () => {
  it('reports the room left', () => {
    expect(fractureMargin({ ecdPpg: 13.05, fractureGradientPpg: 14 })).toEqual({
      marginPpg: 0.95,
      breaking: false,
      fractureTight: false,
    });
  });

  it('flags a tight margin', () => {
    expect(fractureMargin({ ecdPpg: 13.05, fractureGradientPpg: 13.2 }).fractureTight).toBe(true);
  });

  it('flags a formation that is breaking down', () => {
    const broken = fractureMargin({ ecdPpg: 13.5, fractureGradientPpg: 13.2 });
    expect(broken.breaking).toBe(true);
    expect(broken.marginPpg).toBe(-0.3);
  });
});

describe('poreMargin', () => {
  it('reports the overbalance', () => {
    expect(poreMargin({ weightPpg: 12.4, porePressurePpg: 11.9 })).toEqual({
      overbalancePpg: 0.5,
      underbalanced: false,
      overbalanceTight: false,
    });
  });

  it('flags a tight overbalance', () => {
    expect(poreMargin({ weightPpg: 12.1, porePressurePpg: 11.9 }).overbalanceTight).toBe(true);
  });

  it('flags a well that will flow', () => {
    expect(poreMargin({ weightPpg: 11.5, porePressurePpg: 11.9 }).underbalanced).toBe(true);
  });
});

describe('densityWindow', () => {
  const window = densityWindow({
    weightPpg: 12.1,
    annularLossPsi: 336.1,
    tvdFeet: 10000,
    porePressurePpg: 11.9,
    fractureGradientPpg: 14,
  });

  it('keeps the two tight flags apart', () => {
    expect(window.overbalanceTight).toBe(true);
    expect(window.fractureTight).toBe(false);
  });

  it('carries both gradients through for the report', () => {
    expect(window.porePressurePpg).toBe(11.9);
    expect(window.fractureGradientPpg).toBe(14);
  });

  it('reports the circulating density as well as the static one', () => {
    expect(window.ecdPpg).toBeGreaterThan(window.weightPpg);
  });
});
