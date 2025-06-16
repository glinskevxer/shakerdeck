import { describe, it, expect } from 'vitest';
import { fixtures } from '../support/fixtures.js';
import { readHydraulics } from '../../src/cli/commands/hydraulics.js';
import { readCheckSheet } from '../../src/cli/commands/check.js';
import { readDay } from '../../src/cli/commands/daily.js';
import { recapCommand } from '../../src/cli/commands/recap.js';
import { readSolidsControl } from '../../src/cli/commands/solids.js';
import { wellVolumes } from '../../src/well/geometry.js';
import { circulationTimes, pumpOutput } from '../../src/well/pump.js';
import { weightUp } from '../../src/material/weightup.js';
import { readCheck } from '../../src/mudcheck/record.js';

const well = fixtures.well;
const check = fixtures.check;
const day = fixtures.day;
const checks = fixtures.checks;
const programme = fixtures.programme;
const products = fixtures.products;
const days = fixtures.days;
const spread = fixtures.spread;

describe('one well, end to end', () => {
  it('reads the same weight everywhere it appears', () => {
    const sheet = readCheckSheet(check);
    const hydraulics = readHydraulics(well, check);
    const daily = readDay({ day, check, programme, products });
    expect(sheet.density.ppg).toBe(check.weightPpg);
    expect(hydraulics.window.weightPpg).toBe(well.weightPpg);
    expect(daily.check.weightPpg).toBe(check.weightPpg);
  });

  it('reads the same rheology in the check sheet and the hydraulics', () => {
    const sheet = readCheckSheet(check);
    const hydraulics = readHydraulics(well, check);
    expect(sheet.rheology.plasticViscosity).toBe(22);
    expect(hydraulics.pressure.stringPsi).toBeGreaterThan(0);
  });

  it('agrees on the hole volume between the geometry and the hydraulics', () => {
    const volumes = wellVolumes({ hole: well.hole, string: well.string });
    const hydraulics = readHydraulics(well, check);
    expect(hydraulics.volumes.annulusBbl).toBe(volumes.annulusBbl);
    expect(hydraulics.volumes.stringBbl).toBe(volumes.stringBbl);
  });

  it('agrees on the circulating times between the pump and the hydraulics', () => {
    const volumes = wellVolumes({ hole: well.hole, string: well.string });
    const times = circulationTimes({
      stringBbl: volumes.stringBbl,
      annulusBbl: volumes.annulusBbl,
      bblPerStroke: pumpOutput(well.pump),
      strokesPerMinute: well.strokesPerMinute,
    });
    expect(readHydraulics(well, check).circulation).toEqual(times);
  });

  it('carries the day into the recap', () => {
    const recap = recapCommand({ well: 'brazos 14-3', checks, programme, days, products });
    expect(recap.data.checks).toBe(checks.length);
    expect(recap.data.costs.totalCost).toBeGreaterThan(0);
  });

  it('runs the solids spread against the same bit the well carries', () => {
    const solids = readSolidsControl(spread);
    expect(spread.bitDiameterInches).toBe(well.bitDiameterInches);
    expect(solids.removedBbl).toBeLessThanOrEqual(solids.solidsMadeBbl);
  });
});

describe('a weight up all the way through', () => {
  const order = weightUp({ fromPpg: 12.4, toPpg: 13.2, volumeBbl: 800 });

  it('raises the circulating density when the new weight is used', () => {
    const before = readHydraulics(well, check);
    const after = readHydraulics({ ...well, weightPpg: 13.2 }, { ...check, weightPpg: 13.2 });
    expect(after.window.ecdPpg).toBeGreaterThan(before.window.ecdPpg);
  });

  it('narrows the margin to the fracture gradient', () => {
    const before = readHydraulics(well, check);
    const after = readHydraulics({ ...well, weightPpg: 13.2 }, { ...check, weightPpg: 13.2 });
    expect(after.window.marginPpg).toBeLessThan(before.window.marginPpg);
  });

  it('widens the overbalance', () => {
    const before = readHydraulics(well, check);
    const after = readHydraulics({ ...well, weightPpg: 13.2 }, { ...check, weightPpg: 13.2 });
    expect(after.window.overbalancePpg).toBeGreaterThan(before.window.overbalancePpg);
  });

  it('puts the barite it needs on the day report', () => {
    expect(order.sacks).toBeGreaterThan(0);
    const priced = readDay({
      day: { ...day, used: { BAR: order.sacks } },
      check,
      products,
    });
    expect(priced.costs.productCost).toBe(order.sacks * 16);
  });
});

describe('every example file the readme names', () => {
  it('reads with the reader that is meant to read it', () => {
    expect(() => readCheck(check)).not.toThrow();
    for (const record of checks) {
      expect(() => readCheck(record)).not.toThrow();
    }
  });

  it('describes the same well throughout', () => {
    expect(well.well).toBe(check.well);
    expect(day.well).toBe(check.well);
    expect(programme.well).toBe(check.well);
    expect(spread.well).toBe(check.well);
  });

  it('puts the check inside the hole the well file describes', () => {
    expect(check.depthFeet).toBeLessThanOrEqual(well.totalDepthFeet);
  });
});
