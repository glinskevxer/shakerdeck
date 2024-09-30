import { describe, it, expect } from 'vitest';
import {
  SCREEN_TABLE,
  bandFor,
  designationFor,
  finestScreenFor,
  removalShare,
  passedDistribution,
  screenPerformance,
  compareScreens,
} from '../../src/solidscontrol/screens.js';

const distribution = [
  { lowMicrons: 0, highMicrons: 20, share: 0.1 },
  { lowMicrons: 20, highMicrons: 74, share: 0.2 },
  { lowMicrons: 74, highMicrons: 150, share: 0.25 },
  { lowMicrons: 150, highMicrons: 400, share: 0.3 },
  { lowMicrons: 400, highMicrons: 2000, share: 0.15 },
];

describe('SCREEN_TABLE', () => {
  it('runs from coarse to fine', () => {
    for (let i = 1; i < SCREEN_TABLE.length; i += 1) {
      expect(SCREEN_TABLE[i].api).toBeGreaterThan(SCREEN_TABLE[i - 1].api);
      expect(SCREEN_TABLE[i].high).toBeLessThanOrEqual(SCREEN_TABLE[i - 1].high);
    }
  });

  it('has a low below its high in every band', () => {
    for (const row of SCREEN_TABLE) {
      expect(row.low).toBeLessThan(row.high);
    }
  });
});

describe('bandFor', () => {
  it('reads a designation off the table', () => {
    expect(bandFor(200)).toEqual({ api: 200, low: 58, high: 69, midpoint: 63.5 });
  });

  it('refuses a number that is not in the table', () => {
    expect(() => bandFor(210)).toThrow(/no api 210 screen/);
  });
});

describe('designationFor', () => {
  it('places a measured cut point', () => {
    expect(designationFor(63)).toBe(200);
    expect(designationFor(800)).toBe(20);
  });

  it('gives the lower edge to the band it opens', () => {
    expect(designationFor(58)).toBe(200);
    expect(designationFor(69)).toBe(170);
    expect(designationFor(68.9)).toBe(200);
  });

  it('keeps the very top of the table', () => {
    expect(designationFor(925)).toBe(20);
  });

  it('is nothing at all for a cut outside the table', () => {
    expect(designationFor(5000)).toBe(null);
    expect(designationFor(10)).toBe(null);
  });

  it('refuses a cut of nothing', () => {
    expect(() => designationFor(0)).toThrow(/above zero/);
  });
});

describe('finestScreenFor', () => {
  it('picks a finer screen at a lower flow', () => {
    const slow = finestScreenFor({ flowGpm: 200, conductancePerGpm: 0.3 });
    const fast = finestScreenFor({ flowGpm: 800, conductancePerGpm: 0.3 });
    expect(slow.api).toBeGreaterThan(fast.api);
  });

  it('is nothing at all when even the coarsest will not take the flow', () => {
    expect(finestScreenFor({ flowGpm: 5000, conductancePerGpm: 1 })).toBe(null);
  });
});

describe('removalShare', () => {
  it('takes everything coarser than the cut', () => {
    expect(removalShare(distribution, 150)).toBeCloseTo(0.45, 6);
  });

  it('splits the band the cut falls inside', () => {
    const share = removalShare(distribution, 100);
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.7);
  });

  it('takes nothing at all with a cut above the coarsest solids', () => {
    expect(removalShare(distribution, 3000)).toBe(0);
  });

  it('takes very nearly everything with a cut below the finest solids', () => {
    expect(removalShare(distribution, 0.5)).toBeCloseTo(1, 2);
  });

  it('refuses a band that runs backwards', () => {
    expect(() => removalShare([{ lowMicrons: 100, highMicrons: 50, share: 1 }], 60)).toThrow(
      /runs backwards/
    );
  });

  it('refuses a distribution of nothing', () => {
    expect(() => removalShare([{ lowMicrons: 0, highMicrons: 100, share: 0 }], 60)).toThrow(
      /adds up to nothing/
    );
  });
});

describe('passedDistribution', () => {
  it('drops every band above the cut', () => {
    const passed = passedDistribution(distribution, 74);
    expect(passed.map((band) => band.highMicrons)).toEqual([20, 74]);
  });

  it('cuts the band the cut point falls inside', () => {
    const passed = passedDistribution(distribution, 100);
    const partial = passed.at(-1);
    expect(partial.highMicrons).toBe(100);
    expect(partial.share).toBeCloseTo((0.25 * (100 - 74)) / (150 - 74), 6);
  });

  it('keeps everything with a cut above the coarsest band', () => {
    expect(passedDistribution(distribution, 3000)).toHaveLength(5);
  });

  it('keeps nothing at all with a cut below the finest', () => {
    expect(passedDistribution(distribution, 0.0001)[0].share).toBeCloseTo(0, 5);
  });

  it('agrees with the removal share it came from', () => {
    const cut = 74;
    const removed = removalShare(distribution, cut);
    const left = passedDistribution(distribution, cut).reduce((sum, band) => sum + band.share, 0);
    expect(left).toBeCloseTo(1 - removed, 6);
  });

  it('refuses a band that runs backwards', () => {
    expect(() => passedDistribution([{ lowMicrons: 100, highMicrons: 50, share: 1 }], 60)).toThrow(
      /runs backwards/
    );
  });
});

describe('screenPerformance', () => {
  it('splits the solids at the screen', () => {
    const result = screenPerformance({ apiNumber: 200, distribution, solidsBbl: 100 });
    expect(result.cutMicrons).toBe(63.5);
    expect(result.removedBbl + result.passedBbl).toBeCloseTo(100, 1);
  });

  it('takes more out on a finer screen', () => {
    const coarse = screenPerformance({ apiNumber: 80, distribution, solidsBbl: 100 });
    const fine = screenPerformance({ apiNumber: 230, distribution, solidsBbl: 100 });
    expect(fine.removedBbl).toBeGreaterThan(coarse.removedBbl);
  });

  it('takes nothing out of nothing', () => {
    expect(screenPerformance({ apiNumber: 200, distribution, solidsBbl: 0 }).removedBbl).toBe(0);
  });

  it('hands the next stage the sizes that actually got through', () => {
    const result = screenPerformance({ apiNumber: 200, distribution, solidsBbl: 100 });
    expect(result.passedDistribution.every((band) => band.highMicrons <= result.cutMicrons)).toBe(
      true
    );
  });
});

describe('compareScreens', () => {
  it('ranks the screens by what they take out', () => {
    const rows = compareScreens({
      apiNumbers: [80, 140, 230],
      distribution,
      solidsBbl: 100,
    });
    expect(rows.map((row) => row.api)).toEqual([230, 140, 80]);
  });

  it('carries the cut point of each', () => {
    const rows = compareScreens({ apiNumbers: [80], distribution, solidsBbl: 100 });
    expect(rows[0].cutMicrons).toBe(151.3);
  });
});
