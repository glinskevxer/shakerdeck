import { describe, it, expect } from 'vitest';
import { example, capture } from '../support/fixtures.js';
import { run } from '../../src/cli/program.js';
import { readCheck } from '../../src/mudcheck/record.js';
import { readCheckSheet } from '../../src/cli/commands/check.js';
import { readHydraulics } from '../../src/cli/commands/hydraulics.js';
import { invertSummary, oilWaterRatio, stabilityVerdict } from '../../src/mudcheck/invert.js';
import { hthpSummary } from '../../src/mudcheck/hthp.js';
import { waterPhaseSalinity } from '../../src/mudcheck/titration.js';
import { solidsOf } from '../../src/mudcheck/derive.js';

const check = example('check-ward');
const well = example('well-ward');

describe('an oil based mud reads all the way through', () => {
  it('reads the sheet', () => {
    const read = readCheck(check);
    expect(read.base).toBe('oil');
    expect(read.electricalStabilityVolts).toBe(620);
  });

  it('works the solids out against the oil and the brine', () => {
    const solids = solidsOf(readCheck(check));
    expect(solids.averageSg).toBeGreaterThan(2.4);
    expect(solids.averageSg).toBeLessThan(4.3);
  });

  it('reports the oil to water ratio off the liquid phase alone', () => {
    const ratio = oilWaterRatio(check.retort);
    expect(ratio.oil).toBeGreaterThan(check.retort.oilPercent);
    expect(ratio.oil + ratio.water).toBeCloseTo(100, 1);
  });

  it('reads the emulsion as strong', () => {
    expect(stabilityVerdict(check.electricalStabilityVolts)).toBe('strong');
  });

  it('puts the chloride back over the water the retort found', () => {
    expect(waterPhaseSalinity(check.chlorideMgL, check.retort.waterPercent)).toBeGreaterThan(
      check.chlorideMgL
    );
  });

  it('summarises the invert block', () => {
    const summary = invertSummary({
      retort: check.retort,
      electricalStabilityVolts: check.electricalStabilityVolts,
      chlorideMgL: check.chlorideMgL,
    });
    expect(summary.stability).toBe('strong');
    expect(summary.waterPhaseSalinityMgL).toBe(640000);
  });

  it('reads the high temperature filtrate', () => {
    const summary = hthpSummary({
      collectedMillilitres: check.filtrate.hthpMl / 2,
      apiMl: 1.4,
      temperatureF: check.filtrate.hthpTemperatureF,
    });
    expect(summary.hthpMl).toBe(check.filtrate.hthpMl);
    expect(summary.level).toBe('holding');
  });

  it('prints a check sheet with no chemistry block, because there is no filtrate', () => {
    const sheet = readCheckSheet(check);
    expect(sheet.rheology.plasticViscosity).toBe(30);
    expect(sheet.solids.highGravityPercent).toBeGreaterThan(0);
  });
});

describe('a slim hole runs through the hydraulics', () => {
  const data = readHydraulics(well, check);

  it('works the whole circulating system out', () => {
    expect(data.pressure.standpipePsi).toBeGreaterThan(0);
    expect(data.velocities).toHaveLength(4);
  });

  it('runs a much higher annular velocity than the big hole does', () => {
    const brazos = readHydraulics(example('well-brazos'), example('check-brazos'));
    expect(data.slowest.velocityFeetPerMinute).toBeGreaterThan(
      brazos.slowest.velocityFeetPerMinute * 0.5
    );
  });

  it('holds the circulating density inside the window', () => {
    expect(data.window.breaking).toBe(false);
    expect(data.window.underbalanced).toBe(false);
  });

  it('loses a lot more pressure down a three and a half inch string', () => {
    expect(data.pressure.stringPsi).toBeGreaterThan(0);
    expect(data.pressure.standpipePsi).toBeGreaterThan(data.pressure.bitPsi);
  });
});

describe('the commands run against the second well', () => {
  it('reads the check', async () => {
    const io = capture();
    expect(await run(['check', '-c', 'examples/check-ward.json'], io)).toBe(0);
    expect(io.text()).toContain('MUD CHECK WARD 2');
  });

  it('runs the hydraulics', async () => {
    const io = capture();
    expect(
      await run(
        ['hydraulics', '-w', 'examples/well-ward.json', '-c', 'examples/check-ward.json'],
        io
      )
    ).toBe(0);
    expect(io.text()).toContain('HYDRAULICS WARD 2');
  });

  it('refuses to export a single check where a run was wanted', async () => {
    const io = capture();
    expect(await run(['export', '-t', 'checks', '-i', 'examples/check-ward.json'], io)).toBe(2);
    expect(io.errors()).toMatch(/expected a list/);
  });

  it('exports it once it is in a run', async () => {
    const io = capture();
    expect(await run(['export', '-t', 'checks', '-i', 'examples/checks-brazos.json'], io)).toBe(0);
  });
});
