import { describe, it, expect } from 'vitest';
import {
  SURFACE_EQUIVALENT_FEET,
  SURFACE_EQUIVALENT_ID,
  surfaceLoss,
  systemPressure,
  rateForPressure,
  pressureSplit,
} from '../../src/hydraulics/system.js';

const dials = { 600: 64, 300: 42, 200: 33, 100: 23, 6: 6, 3: 5 };

const well = {
  densityPpg: 12.4,
  dials,
  stringSections: [
    { name: 'drill pipe', idInches: 4.276, lengthFeet: 9400 },
    { name: 'drill collars', idInches: 2.8125, lengthFeet: 600 },
  ],
  annulusRows: [
    { holeName: 'casing', pipeName: 'drill pipe', idInches: 8.681, odInches: 5, lengthFeet: 6000 },
    { holeName: 'open hole', pipeName: 'drill pipe', idInches: 8.5, odInches: 5, lengthFeet: 3400 },
    { holeName: 'open hole', pipeName: 'collars', idInches: 8.5, odInches: 6.5, lengthFeet: 600 },
  ],
  nozzleThirtySeconds: [13, 13, 13],
  bitDiameterInches: 8.5,
  surfaceCase: 3,
};

describe('surfaceLoss', () => {
  it('carries the four standard rig ups', () => {
    expect(SURFACE_EQUIVALENT_FEET).toEqual({ 1: 2600, 2: 946, 3: 610, 4: 424 });
    expect(SURFACE_EQUIVALENT_ID).toBe(3.826);
  });

  it('loses more on a small rig than a big one', () => {
    const small = surfaceLoss({
      surfaceCase: 1,
      flowGpm: 600,
      densityPpg: 12.4,
      model: { n: 0.6077, k: 1.014 },
    });
    const large = surfaceLoss({
      surfaceCase: 4,
      flowGpm: 600,
      densityPpg: 12.4,
      model: { n: 0.6077, k: 1.014 },
    });
    expect(small.psi).toBeGreaterThan(large.psi * 5);
  });

  it('refuses a case it does not know', () => {
    expect(() =>
      surfaceLoss({
        surfaceCase: 9,
        flowGpm: 600,
        densityPpg: 12.4,
        model: { n: 0.6077, k: 1.014 },
      })
    ).toThrow(/no surface case 9/);
  });
});

describe('systemPressure', () => {
  const system = systemPressure({ ...well, flowGpm: 600 });

  it('adds every loss into a standpipe pressure', () => {
    expect(system.surfacePsi).toBe(107.4);
    expect(system.stringPsi).toBe(1423.3);
    expect(system.bitPsi).toBe(2719);
    expect(system.annulusPsi).toBe(336.1);
    expect(system.standpipePsi).toBe(4586);
  });

  it('reports the share the bit takes', () => {
    expect(system.bitShare).toBe(0.593);
    expect(system.parasiticPsi).toBe(1867);
  });

  it('puts more through the bit as the nozzles come down', () => {
    const tight = systemPressure({ ...well, nozzleThirtySeconds: [11, 11, 11], flowGpm: 600 });
    expect(tight.bitShare).toBeGreaterThan(system.bitShare);
    expect(tight.standpipePsi).toBeGreaterThan(system.standpipePsi);
  });

  it('leaves the parasitic losses alone when only the nozzles change', () => {
    const tight = systemPressure({ ...well, nozzleThirtySeconds: [11, 11, 11], flowGpm: 600 });
    expect(tight.parasiticPsi).toBe(system.parasiticPsi);
  });

  it('carries the working through for the report', () => {
    expect(system.string.sections).toHaveLength(2);
    expect(system.annulus.sections).toHaveLength(3);
    expect(system.bit.totalFlowArea).toBe(0.3889);
    expect(system.bit.shareOfSystem).toBe(system.bitShare);
  });

  it('climbs steeply with rate', () => {
    const slow = systemPressure({ ...well, flowGpm: 300 });
    expect(system.standpipePsi / slow.standpipePsi).toBeGreaterThan(3);
  });
});

describe('rateForPressure', () => {
  it('finds the rate that lands on a pressure limit', () => {
    const found = rateForPressure(3500, well);
    expect(found.flowGpm).toBe(515);
    expect(found.standpipePsi).toBe(3500);
    expect(found.limited).toBe(null);
  });

  it('agrees with the system it was solved against', () => {
    const found = rateForPressure(3000, well);
    const check = systemPressure({ ...well, flowGpm: found.flowGpm });
    expect(check.standpipePsi).toBeLessThanOrEqual(3000);
  });

  it('says so when even the slowest rate is over the limit', () => {
    const found = rateForPressure(1, well);
    expect(found.flowGpm).toBe(0);
    expect(found.limited).toMatch(/smallest usable rate/);
  });

  it('says so when the limit is never reached', () => {
    const found = rateForPressure(200000, well);
    expect(found.flowGpm).toBe(2000);
    expect(found.limited).toMatch(/not reached/);
  });
});

describe('pressureSplit', () => {
  it('splits the standpipe pressure four ways', () => {
    const split = pressureSplit(systemPressure({ ...well, flowGpm: 600 }));
    expect(split.map((row) => row.part)).toEqual([
      'surface equipment',
      'drill string',
      'bit',
      'annulus',
    ]);
    expect(split.reduce((total, row) => total + row.share, 0)).toBeCloseTo(1, 2);
  });

  it('shows the bit taking the largest share on a well jetted bit', () => {
    const split = pressureSplit(systemPressure({ ...well, flowGpm: 600 }));
    expect(split[2].share).toBeGreaterThan(0.5);
  });
});
