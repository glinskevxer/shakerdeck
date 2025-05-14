import { describe, it, expect } from 'vitest';
import { readCheck, readChecks, SAMPLE_POINTS, BASE_TYPES } from '../../src/mudcheck/record.js';

const full = {
  well: 'brazos 14-3',
  date: '2024-06-12',
  time: '06:00',
  depthFeet: 10450,
  samplePoint: 'flowline',
  base: 'water',
  weightPpg: 12.4,
  funnelSeconds: 48,
  temperatureF: 118,
  ph: 9.6,
  chlorideMgL: 32000,
  totalHardnessMgL: 400,
  sandPercent: 0.25,
  mbtLbBbl: 17.5,
  dials: { 600: 64, 300: 42, 200: 33, 100: 23, 6: 6, 3: 5 },
  gels: { tenSecond: 6, tenMinute: 9 },
  filtrate: { apiMl: 4.8, cakeThirtySecondInch: 2, hthpMl: 12.4, hthpTemperatureF: 250 },
  alkalinity: { pf: 0.4, mf: 1.1, pm: 1.8 },
  retort: { solidsPercent: 18, oilPercent: 0, waterPercent: 82 },
  note: 'raised weight over the tour',
};

describe('readCheck', () => {
  it('reads a full check', () => {
    const check = readCheck(full);
    expect(check.well).toBe('brazos 14-3');
    expect(check.depthFeet).toBe(10450);
    expect(check.weightPpg).toBe(12.4);
    expect(check.dials.get(600)).toBe(64);
    expect(check.gels.tenMinute).toBe(9);
    expect(check.filtrate.apiMl).toBe(4.8);
    expect(check.alkalinity.pm).toBe(1.8);
    expect(check.retort.waterPercent).toBe(82);
  });

  it('reads a bare check taken while tripping', () => {
    const check = readCheck({
      well: 'brazos 14-3',
      date: '2024-06-12',
      depthFeet: 8000,
      weightPpg: 12.3,
      funnelSeconds: 46,
    });
    expect(check.dials).toBe(null);
    expect(check.gels).toBe(null);
    expect(check.filtrate).toBe(null);
    expect(check.alkalinity).toBe(null);
    expect(check.retort).toBe(null);
    expect(check.ph).toBe(null);
  });

  it('defaults the sample point and the base', () => {
    const check = readCheck({ well: 'a', date: '2024-06-12', depthFeet: 1, weightPpg: 9 });
    expect(check.samplePoint).toBe('flowline');
    expect(check.base).toBe('water');
    expect(SAMPLE_POINTS).toContain('shaker');
    expect(BASE_TYPES).toEqual(['water', 'oil', 'synthetic']);
  });

  it('needs a well, a date, a depth and a weight', () => {
    expect(() => readCheck({ ...full, well: '' })).toThrow(/check.well/);
    expect(() => readCheck({ ...full, date: '12 june' })).toThrow(/yyyy-mm-dd, found 12 june/);
    expect(() => readCheck({ ...full, depthFeet: undefined })).toThrow(/check.depthFeet/);
    expect(() => readCheck({ ...full, weightPpg: 0 })).toThrow(/must be above 0/);
    expect(() => readCheck({ ...full, weightPpg: 30 })).toThrow(/must not be above 25/);
  });

  it('refuses a sample point or a base it does not know', () => {
    expect(() => readCheck({ ...full, samplePoint: 'kelly' })).toThrow(/expected one of flowline/);
    expect(() => readCheck({ ...full, base: 'air' })).toThrow(/expected one of water, oil/);
  });

  it('catches a transposed pair of dial readings', () => {
    expect(() => readCheck({ ...full, dials: { 600: 40, 300: 42 } })).toThrow(
      /check.dials: the reading at 600 rpm/
    );
  });

  it('refuses a retort that does not add up to a full cup', () => {
    expect(() =>
      readCheck({ ...full, retort: { solidsPercent: 18, oilPercent: 0, waterPercent: 70 } })
    ).toThrow(/reads 88 percent, which is not a full cup/);
  });

  it('allows a retort a percent out, which is what reading a glass tube gives', () => {
    expect(() =>
      readCheck({ ...full, retort: { solidsPercent: 18.5, oilPercent: 0, waterPercent: 82 } })
    ).not.toThrow();
  });

  it('refuses an electrical stability on a water based mud', () => {
    expect(() => readCheck({ ...full, electricalStabilityVolts: 400 })).toThrow(
      /water based mud has no electrical stability/
    );
  });

  it('takes an electrical stability on an oil based mud', () => {
    const check = readCheck({
      ...full,
      base: 'oil',
      chlorideMgL: null,
      electricalStabilityVolts: 480,
      retort: { solidsPercent: 22, oilPercent: 58, waterPercent: 20 },
    });
    expect(check.electricalStabilityVolts).toBe(480);
  });

  it('ranges the readings that have a physical limit', () => {
    expect(() => readCheck({ ...full, ph: 15 })).toThrow(/must not be above 14/);
    expect(() => readCheck({ ...full, sandPercent: -1 })).toThrow(/must not be below 0/);
    expect(() => readCheck({ ...full, temperatureF: 900 })).toThrow(/must not be above 500/);
  });

  it('names the nested field that is wrong', () => {
    expect(() => readCheck({ ...full, gels: { tenSecond: -1 } })).toThrow(
      /check.gels.tenSecond: must not be below 0/
    );
    expect(() => readCheck({ ...full, filtrate: { apiMl: 'wet' } })).toThrow(
      /check.filtrate.apiMl/
    );
    expect(() => readCheck({ ...full, alkalinity: 4 })).toThrow(
      /check.alkalinity: expected an object/
    );
  });
});

describe('reading a check twice', () => {
  it('gives the same check back', () => {
    const once = readCheck(full);
    const twice = readCheck(once);
    expect(twice.weightPpg).toBe(once.weightPpg);
    expect(twice.dials.get(600)).toBe(64);
    expect(twice.retort).toEqual(once.retort);
  });

  it('does not lose the rheology on the second pass', () => {
    expect(readCheck(readCheck(full)).dials.size).toBe(6);
  });
});

describe('readChecks', () => {
  it('sorts oldest first', () => {
    const rows = readChecks([
      { ...full, date: '2024-06-14', depthFeet: 11000 },
      { ...full, date: '2024-06-12' },
      { ...full, date: '2024-06-13', depthFeet: 10800 },
    ]);
    expect(rows.map((row) => row.date)).toEqual(['2024-06-12', '2024-06-13', '2024-06-14']);
  });

  it('breaks a tie on depth', () => {
    const rows = readChecks([
      { ...full, depthFeet: 10600 },
      { ...full, depthFeet: 10450 },
    ]);
    expect(rows.map((row) => row.depthFeet)).toEqual([10450, 10600]);
  });

  it('names the record that is wrong', () => {
    expect(() => readChecks([full, { ...full, weightPpg: 'heavy' }])).toThrow(
      /checks\[1\].weightPpg/
    );
  });

  it('refuses anything that is not a list', () => {
    expect(() => readChecks(full)).toThrow(/checks: expected a list/);
  });

  it('reads an empty list', () => {
    expect(readChecks([])).toEqual([]);
  });
});
