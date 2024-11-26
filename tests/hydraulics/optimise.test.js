import { describe, it, expect } from 'vitest';
import {
  PARASITIC_EXPONENT,
  OPTIMUM_SHARE,
  fitParasitic,
  parasiticAt,
  optimumRate,
  areaForDrop,
  nozzleSetFor,
  optimiseBit,
} from '../../src/hydraulics/optimise.js';
import { totalFlowArea, bitPressureDrop } from '../../src/hydraulics/bit.js';

const dials = { 600: 64, 300: 42, 200: 33, 100: 23, 6: 6, 3: 5 };
const well = {
  densityPpg: 12.4,
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

describe('the two criteria', () => {
  it('want different shares of the pump pressure', () => {
    expect(PARASITIC_EXPONENT).toBe(1.86);
    expect(OPTIMUM_SHARE.horsepower).toBeCloseTo(0.65, 2);
    expect(OPTIMUM_SHARE['impact force']).toBeCloseTo(0.48, 2);
    expect(OPTIMUM_SHARE.horsepower).toBeGreaterThan(OPTIMUM_SHARE['impact force']);
  });
});

describe('fitParasitic', () => {
  const fit = fitParasitic({ referenceGpm: 600, referencePsi: 1867 });

  it('passes through the point it was fitted to', () => {
    expect(parasiticAt(fit, 600)).toBeCloseTo(1867, 6);
  });

  it('climbs faster than the rate does', () => {
    expect(parasiticAt(fit, 1200) / parasiticAt(fit, 600)).toBeCloseTo(2 ** 1.86, 6);
  });

  it('is nothing with the pump off', () => {
    expect(parasiticAt(fit, 0)).toBe(0);
  });

  it('refuses a fit through nothing', () => {
    expect(() => fitParasitic({ referenceGpm: 0, referencePsi: 1867 })).toThrow(/above zero/);
  });
});

describe('optimumRate', () => {
  const fit = fitParasitic({ referenceGpm: 600, referencePsi: 1867 });

  it('spends about two thirds at the bit for horsepower', () => {
    const optimum = optimumRate({ fit, maximumPsi: 4000 });
    expect(optimum.bitPsi / 4000).toBeCloseTo(0.65, 2);
  });

  it('spends about half for impact force', () => {
    const optimum = optimumRate({ fit, maximumPsi: 4000, criterion: 'impact force' });
    expect(optimum.bitPsi / 4000).toBeCloseTo(0.48, 2);
  });

  it('runs a higher rate for impact force than for horsepower', () => {
    const horsepower = optimumRate({ fit, maximumPsi: 4000 });
    const impact = optimumRate({ fit, maximumPsi: 4000, criterion: 'impact force' });
    expect(impact.flowGpm).toBeGreaterThan(horsepower.flowGpm);
  });

  it('says when the pump rate is the limit rather than the pressure', () => {
    const capped = optimumRate({ fit, maximumPsi: 8000, maximumGpm: 700 });
    expect(capped.flowGpm).toBe(700);
    expect(capped.rateLimited).toBe(true);
  });

  it('refuses a criterion it does not know', () => {
    expect(() => optimumRate({ fit, maximumPsi: 4000, criterion: 'cleanest' })).toThrow(
      /no criterion called cleanest/
    );
  });
});

describe('areaForDrop', () => {
  it('inverts the bit pressure drop', () => {
    const area = areaForDrop({ bitPsi: 2719, flowGpm: 600, densityPpg: 12.4 });
    expect(area).toBeCloseTo(totalFlowArea([13, 13, 13]), 3);
  });

  it('opens up as the wanted drop falls', () => {
    expect(areaForDrop({ bitPsi: 1000, flowGpm: 600, densityPpg: 12.4 })).toBeGreaterThan(
      areaForDrop({ bitPsi: 3000, flowGpm: 600, densityPpg: 12.4 })
    );
  });

  it('refuses a drop of nothing', () => {
    expect(() => areaForDrop({ bitPsi: 0, flowGpm: 600, densityPpg: 12.4 })).toThrow(/above zero/);
  });
});

describe('nozzleSetFor', () => {
  it('finds a set close to the area wanted', () => {
    const set = nozzleSetFor({ areaSquareInches: totalFlowArea([13, 13, 13]) });
    expect(set.nozzles).toEqual([13, 13, 13]);
    expect(Math.abs(set.missSquareInches)).toBeLessThan(0.01);
  });

  it('prefers the slightly tight set to the slightly open one', () => {
    const set = nozzleSetFor({ areaSquareInches: totalFlowArea([13, 13, 13]) + 0.01 });
    expect(set.missSquareInches).toBeLessThanOrEqual(0.01);
  });

  it('takes a mixed set where one whole size is too coarse', () => {
    const set = nozzleSetFor({ areaSquareInches: 0.42 });
    expect(new Set(set.nozzles).size).toBeGreaterThanOrEqual(1);
    expect(set.nozzles).toHaveLength(3);
  });

  it('takes a different nozzle count', () => {
    expect(nozzleSetFor({ areaSquareInches: 0.5, count: 4 }).nozzles).toHaveLength(4);
  });
});

describe('optimiseBit', () => {
  const rows = optimiseBit({ well, dials, referenceGpm: 600, maximumPsi: 4000 });

  it('works both criteria out', () => {
    expect(rows.map((row) => row.criterion)).toEqual(['horsepower', 'impact force']);
  });

  it('gives each one a nozzle set', () => {
    for (const row of rows) {
      expect(row.nozzles).toHaveLength(3);
      expect(row.actualBitPsi).toBeGreaterThan(0);
    }
  });

  it('lands near the drop it was aiming at', () => {
    for (const row of rows) {
      expect(Math.abs(row.actualBitPsi - row.bitPsi) / row.bitPsi).toBeLessThan(0.25);
    }
  });

  it('agrees with the bit module it came from', () => {
    const row = rows[0];
    expect(
      bitPressureDrop({
        flowGpm: row.flowGpm,
        totalFlowAreaSquareInches: row.totalFlowArea,
        densityPpg: 12.4,
      })
    ).toBeCloseTo(row.actualBitPsi, 0);
  });
});
