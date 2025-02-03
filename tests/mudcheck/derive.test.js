import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  rheologyOf,
  solidsOf,
  waterFractionOf,
  derive,
  judgeableReadings,
} from '../../src/mudcheck/derive.js';
import { readCheck } from '../../src/mudcheck/record.js';
import { readCheckSheet } from '../../src/cli/commands/check.js';
import { buildDaily } from '../../src/report/daily.js';
import { checkRow } from '../../src/report/export.js';
import { judgeable } from '../../src/quality/exceptions.js';

const raw = JSON.parse(readFileSync('examples/check-brazos.json', 'utf8'));
const check = readCheck(raw);
const bare = readCheck({ well: 'ward 2', date: '2025-03-06', depthFeet: 4000, weightPpg: 9.4 });

describe('rheologyOf', () => {
  it('works the block out when the dials are there', () => {
    expect(rheologyOf(check).plasticViscosity).toBe(22);
  });

  it('is nothing when they are not', () => {
    expect(rheologyOf(bare)).toBe(null);
    expect(rheologyOf(null)).toBe(null);
  });
});

describe('solidsOf', () => {
  it('works the block out when the retort was run', () => {
    expect(solidsOf(check).highGravityPercent).toBe(12.37);
  });

  it('always takes the clay figure into the split', () => {
    expect(solidsOf(check).bentonitePercent).toBeGreaterThan(0);
    expect(solidsOf({ ...check, mbtLbBbl: null }).bentonitePercent).toBe(0);
  });

  it('is nothing when it was not', () => {
    expect(solidsOf(bare)).toBe(null);
    expect(solidsOf(null)).toBe(null);
  });
});

describe('waterFractionOf', () => {
  it('reads the retort water', () => {
    expect(waterFractionOf(check)).toBeCloseTo(0.82, 6);
  });

  it('takes the mud as all water with no retort', () => {
    expect(waterFractionOf(bare)).toBe(1);
  });
});

describe('derive', () => {
  it('returns all three together', () => {
    const derived = derive(check);
    expect(derived.rheology.plasticViscosity).toBe(22);
    expect(derived.solids.drilledPercent).toBe(3.71);
    expect(derived.waterFraction).toBeCloseTo(0.82, 6);
  });
});

describe('every reader agrees', () => {
  it('gives the same rheology to the check sheet, the report and the export', () => {
    const sheet = readCheckSheet(raw);
    const daily = buildDaily({ well: 'x', date: raw.date, check: raw });
    const row = checkRow(check);
    expect(sheet.rheology.plasticViscosity).toBe(daily.rheology.plasticViscosity);
    expect(row.plasticViscosity).toBe(daily.rheology.plasticViscosity);
  });

  it('gives the same drilled solids to all three', () => {
    const sheet = readCheckSheet(raw);
    const daily = buildDaily({ well: 'x', date: raw.date, check: raw });
    const row = checkRow(check);
    expect(sheet.solids.drilledPercent).toBe(daily.solids.drilledPercent);
    expect(row.drilledPercent).toBe(daily.solids.drilledPercent);
  });

  it('gives the exception reader the same readings as the window block', () => {
    expect(judgeable(check)).toEqual(judgeableReadings(check));
  });
});

describe('judgeableReadings', () => {
  it('flattens every property a window can judge', () => {
    const readings = judgeableReadings(check);
    expect(readings.plasticViscosity).toBe(22);
    expect(readings.filtrateApiMl).toBe(4.8);
    expect(readings.solidsPercent).toBe(18);
  });

  it('leaves out what was not measured', () => {
    const readings = judgeableReadings(bare);
    expect(readings.plasticViscosity).toBe(null);
    expect(readings.filtrateApiMl).toBe(null);
    expect(readings.weightPpg).toBe(9.4);
  });
});
