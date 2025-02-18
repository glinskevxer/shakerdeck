import { describe, it, expect } from 'vitest';
import {
  CALIBRATION_TOLERANCE,
  calibrate,
  corrected,
  errorAtDepth,
  compareBalances,
  agreesWithRetort,
} from '../../src/mudcheck/balance.js';
import { WATER_PPG } from '../../src/units/density.js';

describe('calibrate', () => {
  it('passes a balance that reads water right', () => {
    const check = calibrate({ readingPpg: WATER_PPG });
    expect(check.errorPpg).toBe(0);
    expect(check.withinTolerance).toBe(true);
  });

  it('passes one a little out', () => {
    expect(CALIBRATION_TOLERANCE).toBe(0.1);
    expect(calibrate({ readingPpg: 8.4 }).withinTolerance).toBe(true);
  });

  it('fails one that is further out than that', () => {
    const check = calibrate({ readingPpg: 8.6 });
    expect(check.withinTolerance).toBe(false);
    expect(check.errorPpg).toBeGreaterThan(0.2);
  });

  it('hands back the correction to apply', () => {
    const check = calibrate({ readingPpg: 8.6 });
    expect(check.correction).toBe(-check.errorPpg);
  });

  it('takes a different water at temperature', () => {
    expect(calibrate({ readingPpg: 8.3, waterPpg: 8.3 }).errorPpg).toBe(0);
  });
});

describe('corrected', () => {
  it('applies the correction to a reading', () => {
    const check = calibrate({ readingPpg: 8.6 });
    expect(corrected({ readingPpg: 12.65, correction: check.correction })).toBe(12.4);
  });

  it('leaves a good balance alone', () => {
    expect(corrected({ readingPpg: 12.4, correction: 0 })).toBe(12.4);
  });
});

describe('errorAtDepth', () => {
  it('turns a tenth of a pound into psi', () => {
    expect(errorAtDepth({ errorPpg: 0.1, tvdFeet: 10000 }).psi).toBe(52);
  });

  it('is nothing at surface and nothing for no error', () => {
    expect(errorAtDepth({ errorPpg: 0, tvdFeet: 10000 }).psi).toBe(0);
  });

  it('goes negative when the balance reads light', () => {
    expect(errorAtDepth({ errorPpg: -0.2, tvdFeet: 10000 }).psi).toBe(-104);
  });
});

describe('compareBalances', () => {
  const comparison = compareBalances({
    readings: [
      { label: 'lab', waterReadingPpg: 8.35, mudReadingPpg: 12.4 },
      { label: 'shakers', waterReadingPpg: 8.62, mudReadingPpg: 12.65 },
    ],
  });

  it('names the one to take to the water bucket', () => {
    expect(comparison.worst).toBe('shakers');
  });

  it('reports the spread between them', () => {
    expect(comparison.spreadPpg).toBeCloseTo(0.27, 2);
  });

  it('says when one of them is out of tolerance', () => {
    expect(comparison.allWithinTolerance).toBe(false);
  });

  it('says when both are fine', () => {
    const both = compareBalances({
      readings: [
        { label: 'lab', waterReadingPpg: 8.35 },
        { label: 'shakers', waterReadingPpg: 8.38 },
      ],
    });
    expect(both.allWithinTolerance).toBe(true);
  });

  it('refuses a comparison of one', () => {
    expect(() => compareBalances({ readings: [{ waterReadingPpg: 8.35 }] })).toThrow(
      /at least two balances/
    );
  });
});

describe('agreesWithRetort', () => {
  it('agrees on a sound pair of readings', () => {
    const check = agreesWithRetort({
      weightPpg: 12.4,
      solidsPercent: 18,
      waterPercent: 82,
      averageSolidsSg: 3.699,
    });
    expect(check.agrees).toBe(true);
    expect(check.impliedPpg).toBeCloseTo(12.4, 1);
  });

  it('disagrees when the balance reads heavy for the solids found', () => {
    const check = agreesWithRetort({ weightPpg: 14, solidsPercent: 18, waterPercent: 82 });
    expect(check.agrees).toBe(false);
    expect(check.differencePpg).toBeGreaterThan(0.3);
  });

  it('takes the oil on an invert', () => {
    const check = agreesWithRetort({
      weightPpg: 14.5,
      solidsPercent: 28,
      waterPercent: 20,
      oilPercent: 52,
      averageSolidsSg: 3.824,
    });
    expect(check.agrees).toBe(true);
  });
});
