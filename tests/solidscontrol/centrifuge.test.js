import { describe, it, expect } from 'vitest';
import {
  split,
  dilutedFeed,
  solidsRate,
  centrifugeRun,
  centrifugeValue,
} from '../../src/solidscontrol/centrifuge.js';

describe('split', () => {
  it('splits the feed between the two streams', () => {
    const streams = split({ feedGpm: 80, feedPpg: 11.35, underflowPpg: 21, overflowPpg: 9.6 });
    expect(streams.underflowGpm + streams.overflowGpm).toBeCloseTo(80, 1);
    expect(streams.underflowShare).toBe(0.154);
  });

  it('sends more to the underflow on a heavier feed', () => {
    const light = split({ feedGpm: 80, feedPpg: 10.5, underflowPpg: 21, overflowPpg: 9.6 });
    const heavy = split({ feedGpm: 80, feedPpg: 13, underflowPpg: 21, overflowPpg: 9.6 });
    expect(heavy.underflowGpm).toBeGreaterThan(light.underflowGpm);
  });

  it('sends everything one way when the feed matches a stream', () => {
    expect(
      split({ feedGpm: 80, feedPpg: 9.6, underflowPpg: 21, overflowPpg: 9.6 }).underflowGpm
    ).toBe(0);
    expect(
      split({ feedGpm: 80, feedPpg: 21, underflowPpg: 21, overflowPpg: 9.6 }).overflowGpm
    ).toBe(0);
  });

  it('refuses an underflow lighter than the overflow', () => {
    expect(() => split({ feedGpm: 80, feedPpg: 11.35, underflowPpg: 9, overflowPpg: 9.6 })).toThrow(
      /not heavier than/
    );
  });

  it('refuses a feed outside the two streams', () => {
    expect(() => split({ feedGpm: 80, feedPpg: 22, underflowPpg: 21, overflowPpg: 9.6 })).toThrow(
      /cannot split into/
    );
    expect(() => split({ feedGpm: 80, feedPpg: 9, underflowPpg: 21, overflowPpg: 9.6 })).toThrow(
      /cannot split into/
    );
  });
});

describe('dilutedFeed', () => {
  it('thins the mud with water', () => {
    const feed = dilutedFeed({ mudGpm: 60, mudPpg: 12.4, waterGpm: 20 });
    expect(feed.feedGpm).toBe(80);
    expect(feed.feedPpg).toBe(11.39);
    expect(feed.feedPpg).toBeLessThan(12.4);
  });

  it('is the mud on its own with no water', () => {
    expect(dilutedFeed({ mudGpm: 60, mudPpg: 12.4, waterGpm: 0 }).feedPpg).toBe(12.4);
  });

  it('takes base oil as the dilutant', () => {
    const oil = dilutedFeed({ mudGpm: 60, mudPpg: 12.4, waterGpm: 20, waterPpg: 7 });
    expect(oil.feedPpg).toBeLessThan(
      dilutedFeed({ mudGpm: 60, mudPpg: 12.4, waterGpm: 20 }).feedPpg
    );
  });
});

describe('solidsRate', () => {
  it('reads the solids out of a stream density', () => {
    const rate = solidsRate({ gpm: 16.4, ppg: 21, solidsSg: 4.2 });
    expect(rate.volumeFraction).toBe(0.4739);
    expect(rate.solidsPoundsPerHour).toBe(16320);
  });

  it('reads nothing out of plain water', () => {
    expect(solidsRate({ gpm: 20, ppg: 8.3454, solidsSg: 4.2 }).volumeFraction).toBe(0);
  });

  it('refuses solids lighter than the liquid', () => {
    expect(() => solidsRate({ gpm: 20, ppg: 9, solidsSg: 0.9 })).toThrow(/not heavier than/);
  });
});

describe('centrifugeRun', () => {
  const run = centrifugeRun({
    mudGpm: 60,
    mudPpg: 12.4,
    waterGpm: 20,
    underflowPpg: 21,
    overflowPpg: 9.6,
    hours: 12,
  });

  it('reports the feed it actually saw', () => {
    expect(run.feedGpm).toBe(80);
    expect(run.feedPpg).toBe(11.39);
  });

  it('recovers barite in the underflow', () => {
    expect(run.bariteRecoveredPounds).toBeGreaterThan(100000);
    expect(run.bariteRecoveredBbl).toBeGreaterThan(50);
  });

  it('throws drilled solids and liquid over the weir', () => {
    expect(run.solidsDiscardedPounds).toBeGreaterThan(0);
    expect(run.liquidDiscardedBbl).toBeGreaterThan(0);
  });

  it('recovers proportionally more over a longer run', () => {
    const short = centrifugeRun({
      mudGpm: 60,
      mudPpg: 12.4,
      waterGpm: 20,
      underflowPpg: 21,
      overflowPpg: 9.6,
      hours: 6,
    });
    expect(run.bariteRecoveredPounds / short.bariteRecoveredPounds).toBeCloseTo(2, 2);
  });
});

describe('centrifugeValue', () => {
  const run = centrifugeRun({
    mudGpm: 60,
    mudPpg: 12.4,
    waterGpm: 20,
    underflowPpg: 21,
    overflowPpg: 9.6,
    hours: 12,
  });

  it('counts the barite saved against the mud and the running cost', () => {
    const value = centrifugeValue({
      run,
      baritePricePerPound: 0.16,
      mudCostPerBbl: 38,
      runningCostPerHour: 45,
      hours: 12,
    });
    expect(value.bariteSaved).toBeGreaterThan(20000);
    expect(value.netValue).toBe(value.bariteSaved - value.mudAndRunningCost);
  });

  it('is worth running when the liquid it throws away is cheap', () => {
    const value = centrifugeValue({
      run,
      baritePricePerPound: 0.16,
      mudCostPerBbl: 4,
      runningCostPerHour: 45,
      hours: 12,
    });
    expect(value.worthRunning).toBe(true);
  });

  it('is not worth running when the mud is dear', () => {
    const value = centrifugeValue({
      run,
      baritePricePerPound: 0.16,
      mudCostPerBbl: 38,
      runningCostPerHour: 45,
      hours: 12,
    });
    expect(value.worthRunning).toBe(false);
  });
});
