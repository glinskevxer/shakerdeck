import { describe, it, expect } from 'vitest';
import {
  HTHP_AREA_FACTOR,
  reportedFiltrate,
  spurtLoss,
  filtrateAt,
  filtrationVerdict,
  hthpSummary,
} from '../../src/mudcheck/hthp.js';

describe('reportedFiltrate', () => {
  it('doubles the volume in the cylinder', () => {
    expect(HTHP_AREA_FACTOR).toBe(2);
    expect(reportedFiltrate(6.2)).toBe(12.4);
  });

  it('is nothing for a cell that gave nothing', () => {
    expect(reportedFiltrate(0)).toBe(0);
  });

  it('refuses a negative volume', () => {
    expect(() => reportedFiltrate(-1)).toThrow(/not be negative/);
  });
});

describe('spurtLoss', () => {
  const spurt = spurtLoss({
    atMinutes: 7.5,
    collectedMillilitres: 3.4,
    thirtyMinuteMillilitres: 12.4,
  });

  it('extrapolates back to time zero on the root of time', () => {
    expect(spurt.spurtMillilitres).toBeGreaterThan(0);
    expect(spurt.spurtMillilitres).toBeLessThan(12.4);
  });

  it('says a mud with a small spurt has bridging in it', () => {
    expect(spurt.hasBridging).toBe(true);
  });

  it('says a mud with a large spurt has none', () => {
    const bare = spurtLoss({
      atMinutes: 7.5,
      collectedMillilitres: 5.5,
      thirtyMinuteMillilitres: 12.4,
    });
    expect(bare.hasBridging).toBe(false);
  });

  it('never reports a negative spurt', () => {
    const odd = spurtLoss({
      atMinutes: 7.5,
      collectedMillilitres: 1,
      thirtyMinuteMillilitres: 12.4,
    });
    expect(odd.spurtMillilitres).toBe(0);
  });

  it('refuses a spurt reading taken at or after thirty minutes', () => {
    expect(() =>
      spurtLoss({ atMinutes: 30, collectedMillilitres: 6, thirtyMinuteMillilitres: 12.4 })
    ).toThrow(/before thirty minutes/);
  });
});

describe('filtrateAt', () => {
  const spurt = spurtLoss({
    atMinutes: 7.5,
    collectedMillilitres: 3.4,
    thirtyMinuteMillilitres: 12.4,
  });

  it('lands on the thirty minute figure it was fitted to', () => {
    expect(
      filtrateAt({ ...spurt, spurtMillilitres: spurt.spurtMillilitres, minutes: 30 })
    ).toBeCloseTo(12.4, 1);
  });

  it('is the spurt at time zero', () => {
    expect(filtrateAt({ ...spurt, minutes: 0 })).toBe(spurt.spurtMillilitres);
  });

  it('climbs all the way', () => {
    expect(filtrateAt({ ...spurt, minutes: 60 })).toBeGreaterThan(
      filtrateAt({ ...spurt, minutes: 30 })
    );
  });
});

describe('filtrationVerdict', () => {
  it('holds when the two figures are close', () => {
    expect(filtrationVerdict({ apiMl: 4.8, hthpMl: 12.4, hthpTemperatureF: 250 }).level).toBe(
      'holding'
    );
  });

  it('thins at four times', () => {
    expect(filtrationVerdict({ apiMl: 4, hthpMl: 18, hthpTemperatureF: 250 }).level).toBe(
      'thinning at temperature'
    );
  });

  it('fails at six', () => {
    expect(filtrationVerdict({ apiMl: 4, hthpMl: 26, hthpTemperatureF: 300 }).level).toBe(
      'failing at temperature'
    );
  });

  it('carries the temperature it was run at', () => {
    expect(
      filtrationVerdict({ apiMl: 4.8, hthpMl: 12.4, hthpTemperatureF: 300 }).temperatureF
    ).toBe(300);
  });

  it('refuses a filtrate of nothing, which is not a reading', () => {
    expect(() => filtrationVerdict({ apiMl: 0, hthpMl: 12, hthpTemperatureF: 250 })).toThrow(
      /above zero/
    );
  });
});

describe('hthpSummary', () => {
  it('is the block the report prints', () => {
    const summary = hthpSummary({
      collectedMillilitres: 6.2,
      apiMl: 4.8,
      temperatureF: 250,
      spurtAtMinutes: 7.5,
      spurtCollectedMillilitres: 3.4,
      cakeThirtySecondInch: 3,
    });
    expect(summary.hthpMl).toBe(12.4);
    expect(summary.level).toBe('holding');
    expect(summary.spurt.hasBridging).toBe(true);
    expect(summary.cakeThirtySecondInch).toBe(3);
  });

  it('leaves the spurt out when it was not read', () => {
    const summary = hthpSummary({ collectedMillilitres: 6.2, apiMl: 4.8, temperatureF: 250 });
    expect(summary.spurt).toBe(null);
  });
});
