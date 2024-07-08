import { describe, it, expect } from 'vitest';
import {
  oilWaterRatio,
  ratioAdjustment,
  stabilityVerdict,
  stabilityTrend,
  calciumChlorideForSalinity,
  invertSummary,
} from '../../src/mudcheck/invert.js';

const retort = { solidsPercent: 28, oilPercent: 52, waterPercent: 20 };

describe('oilWaterRatio', () => {
  it('is a ratio of the liquid, not of the whole cup', () => {
    expect(oilWaterRatio(retort)).toEqual({ oil: 72.2, water: 27.8 });
  });

  it('reads higher than taking it off the whole retort would', () => {
    const proper = oilWaterRatio(retort);
    const naive = (retort.oilPercent / 100) * 100;
    expect(proper.oil).toBeGreaterThan(naive);
  });

  it('adds to a hundred', () => {
    const ratio = oilWaterRatio(retort);
    expect(ratio.oil + ratio.water).toBeCloseTo(100, 1);
  });

  it('refuses a retort with no liquid', () => {
    expect(() => oilWaterRatio({ oilPercent: 0, waterPercent: 0 })).toThrow(/no liquid at all/);
  });
});

describe('ratioAdjustment', () => {
  it('adds oil to raise the ratio', () => {
    const job = ratioAdjustment({ ...retort, targetOil: 80, volumeBbl: 800 });
    expect(job.addOilBbl).toBeGreaterThan(0);
    expect(job.addBrineBbl).toBe(0);
    expect(job.finalVolumeBbl).toBeGreaterThan(800);
  });

  it('adds brine to bring it down', () => {
    const job = ratioAdjustment({ ...retort, targetOil: 65, volumeBbl: 800 });
    expect(job.addBrineBbl).toBeGreaterThan(0);
    expect(job.addOilBbl).toBe(0);
  });

  it('lands on the ratio it was asked for', () => {
    const job = ratioAdjustment({ ...retort, targetOil: 80, volumeBbl: 800 });
    const oilBbl = (800 * retort.oilPercent) / 100 + job.addOilBbl;
    const waterBbl = (800 * retort.waterPercent) / 100;
    expect((oilBbl * 100) / (oilBbl + waterBbl)).toBeCloseTo(80, 1);
  });

  it('adds nothing when the mud is already there', () => {
    const job = ratioAdjustment({ ...retort, targetOil: 72.2, volumeBbl: 800 });
    expect(job.addOilBbl).toBeLessThan(0.1);
  });

  it('refuses a ratio with no water in it', () => {
    expect(() => ratioAdjustment({ ...retort, targetOil: 100, volumeBbl: 800 })).toThrow(
      /needs some water/
    );
  });
});

describe('stabilityVerdict', () => {
  it('puts a word to the volts', () => {
    expect(stabilityVerdict(620)).toBe('strong');
    expect(stabilityVerdict(400)).toBe('serviceable');
    expect(stabilityVerdict(200)).toBe('weak');
    expect(stabilityVerdict(90)).toBe('breaking');
  });

  it('takes each band at its lower edge', () => {
    expect(stabilityVerdict(500)).toBe('strong');
    expect(stabilityVerdict(300)).toBe('serviceable');
    expect(stabilityVerdict(150)).toBe('weak');
  });
});

describe('stabilityTrend', () => {
  it('holds when the readings barely move', () => {
    const trend = stabilityTrend([420, 415, 430, 425]);
    expect(trend.direction).toBe('holding');
    expect(trend.treat).toBe(false);
  });

  it('calls a fall even when the last reading still reads serviceable', () => {
    const trend = stabilityTrend([620, 540, 460, 400]);
    expect(trend.direction).toBe('falling');
    expect(trend.verdict).toBe('serviceable');
    expect(trend.treat).toBe(true);
  });

  it('calls a climb after treatment', () => {
    expect(stabilityTrend([300, 420, 560]).direction).toBe('climbing');
  });

  it('treats a breaking mud however flat the trend is', () => {
    expect(stabilityTrend([120, 118, 122]).treat).toBe(true);
  });

  it('refuses a single reading', () => {
    expect(() => stabilityTrend([400])).toThrow(/at least two readings/);
  });
});

describe('calciumChlorideForSalinity', () => {
  it('works out the salt for a salinity', () => {
    const job = calciumChlorideForSalinity({
      targetMgL: 180000,
      currentMgL: 150000,
      waterBbl: 160,
    });
    expect(job.poundsNeeded).toBeGreaterThan(0);
    expect(job.alreadyAbove).toBe(false);
  });

  it('needs none when the water is already salty enough', () => {
    const job = calciumChlorideForSalinity({
      targetMgL: 150000,
      currentMgL: 180000,
      waterBbl: 160,
    });
    expect(job.poundsNeeded).toBe(0);
    expect(job.alreadyAbove).toBe(true);
  });

  it('scales with the water phase', () => {
    const small = calciumChlorideForSalinity({
      targetMgL: 180000,
      currentMgL: 150000,
      waterBbl: 80,
    });
    const large = calciumChlorideForSalinity({
      targetMgL: 180000,
      currentMgL: 150000,
      waterBbl: 160,
    });
    expect(large.poundsNeeded).toBeCloseTo(small.poundsNeeded * 2, 0);
  });
});

describe('invertSummary', () => {
  it('is the invert block of the report', () => {
    const summary = invertSummary({
      retort,
      electricalStabilityVolts: 480,
      chlorideMgL: 32000,
    });
    expect(summary.oilWaterRatio).toBe('72.2 / 27.8');
    expect(summary.stability).toBe('serviceable');
    expect(summary.waterPhaseSalinityMgL).toBe(160000);
  });

  it('is nothing at all on a water based mud', () => {
    expect(invertSummary({ retort: { solidsPercent: 18, oilPercent: 0, waterPercent: 82 } })).toBe(
      null
    );
    expect(invertSummary({})).toBe(null);
  });

  it('leaves out what was not measured', () => {
    const summary = invertSummary({ retort });
    expect(summary.stability).toBe(null);
    expect(summary.waterPhaseSalinityMgL).toBe(null);
  });
});
