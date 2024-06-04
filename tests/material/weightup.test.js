import { describe, it, expect } from 'vitest';
import {
  WEIGHTING_AGENTS,
  weightUp,
  weightUpHoldingVolume,
  cutBack,
  blendWeight,
  blendToTarget,
} from '../../src/material/weightup.js';

describe('weightUp', () => {
  const job = weightUp({ fromPpg: 12.4, toPpg: 13.5, volumeBbl: 800 });

  it('carries the agents the desk stocks', () => {
    expect(Object.keys(WEIGHTING_AGENTS)).toContain('barite');
    expect(WEIGHTING_AGENTS.barite.sg).toBe(4.2);
    expect(WEIGHTING_AGENTS.hematite.sg).toBe(4.9);
  });

  it('works out the barite for a pound and a bit', () => {
    expect(job.poundsPerBarrel).toBe(75);
    expect(job.totalPounds).toBe(60026);
    expect(job.sacks).toBe(601);
  });

  it('rounds the sacks up, because half a sack cannot be ordered', () => {
    const small = weightUp({ fromPpg: 12.4, toPpg: 12.41, volumeBbl: 10 });
    expect(Number.isInteger(small.sacks)).toBe(true);
    expect(small.sacks * 100).toBeGreaterThanOrEqual(small.totalPounds);
  });

  it('reports the volume the system grows by', () => {
    expect(job.volumeIncreaseBbl).toBe(40.8);
    expect(job.finalVolumeBbl).toBe(840.8);
  });

  it('needs less hematite than barite for the same weight', () => {
    const iron = weightUp({ fromPpg: 12.4, toPpg: 13.5, volumeBbl: 800, agent: 'hematite' });
    expect(iron.totalPounds).toBeLessThan(job.totalPounds);
    expect(iron.volumeIncreaseBbl).toBeLessThan(job.volumeIncreaseBbl);
  });

  it('refuses a target at or below where the mud already is', () => {
    expect(() => weightUp({ fromPpg: 12.4, toPpg: 12.4, volumeBbl: 800 })).toThrow(
      /not above the 12.4/
    );
    expect(() => weightUp({ fromPpg: 12.4, toPpg: 11, volumeBbl: 800 })).toThrow(/not above/);
  });

  it('refuses a target the agent cannot reach', () => {
    expect(() =>
      weightUp({ fromPpg: 12.4, toPpg: 23, volumeBbl: 800, agent: 'calcium carbonate' })
    ).toThrow(/calcium carbonate weighs 22.53, it cannot make a 23 mud/);
  });

  it('refuses an agent it does not stock', () => {
    expect(() => weightUp({ fromPpg: 12.4, toPpg: 13.5, volumeBbl: 800, agent: 'sand' })).toThrow(
      /no weighting agent called sand/
    );
  });
});

describe('weightUpHoldingVolume', () => {
  const job = weightUpHoldingVolume({ fromPpg: 12.4, toPpg: 13.5, volumeBbl: 800 });

  it('dumps mud first so the system ends where it started', () => {
    expect(job.finalVolumeBbl).toBeCloseTo(800, 0);
    expect(job.discardBbl).toBeGreaterThan(38);
  });

  it('needs less barite than letting the volume grow', () => {
    const growing = weightUp({ fromPpg: 12.4, toPpg: 13.5, volumeBbl: 800 });
    expect(job.totalPounds).toBeLessThan(growing.totalPounds);
  });

  it('mixes to the same pounds per barrel either way', () => {
    const growing = weightUp({ fromPpg: 12.4, toPpg: 13.5, volumeBbl: 800 });
    expect(job.poundsPerBarrel).toBe(growing.poundsPerBarrel);
  });
});

describe('cutBack', () => {
  it('works out the water for a pound off', () => {
    const job = cutBack({ fromPpg: 12.4, toPpg: 11.5, volumeBbl: 800 });
    expect(job.addedBbl).toBe(228.2);
    expect(job.finalVolumeBbl).toBe(1028.2);
  });

  it('takes base oil as the dilutant on an invert', () => {
    const oil = cutBack({ fromPpg: 12.4, toPpg: 11.5, volumeBbl: 800, dilutantPpg: 7 });
    const water = cutBack({ fromPpg: 12.4, toPpg: 11.5, volumeBbl: 800 });
    expect(oil.addedBbl).toBeLessThan(water.addedBbl);
  });

  it('refuses a target at or above where the mud is', () => {
    expect(() => cutBack({ fromPpg: 12.4, toPpg: 12.4, volumeBbl: 800 })).toThrow(/not below/);
  });

  it('refuses a target the dilutant cannot reach', () => {
    expect(() => cutBack({ fromPpg: 12.4, toPpg: 8, volumeBbl: 800 })).toThrow(/cannot make a 8/);
  });
});

describe('blendWeight', () => {
  it('is the volume weighted average', () => {
    expect(
      blendWeight([
        { volumeBbl: 400, weightPpg: 12.4 },
        { volumeBbl: 200, weightPpg: 9.2 },
      ])
    ).toEqual({ volumeBbl: 600, weightPpg: 11.33 });
  });

  it('is the weight of a single part on its own', () => {
    expect(blendWeight([{ volumeBbl: 400, weightPpg: 12.4 }]).weightPpg).toBe(12.4);
  });

  it('names the part that is wrong', () => {
    expect(() => blendWeight([{ volumeBbl: 400 }])).toThrow(/part 1 weightPpg/);
  });

  it('refuses a blend of nothing', () => {
    expect(() => blendWeight([{ volumeBbl: 0, weightPpg: 12 }])).toThrow(/blend of nothing/);
    expect(() => blendWeight([])).toThrow(/at least one part/);
  });
});

describe('blendToTarget', () => {
  it('works out the heavy mud to run in', () => {
    const job = blendToTarget({
      lightPpg: 9.2,
      heavyPpg: 16,
      targetPpg: 12.4,
      lightVolumeBbl: 400,
    });
    expect(job.heavyVolumeBbl).toBe(355.6);
    expect(job.finalVolumeBbl).toBe(755.6);
  });

  it('lands on the weight it was asked for', () => {
    const job = blendToTarget({
      lightPpg: 9.2,
      heavyPpg: 16,
      targetPpg: 12.4,
      lightVolumeBbl: 400,
    });
    const blend = blendWeight([
      { volumeBbl: 400, weightPpg: 9.2 },
      { volumeBbl: job.heavyVolumeBbl, weightPpg: 16 },
    ]);
    expect(blend.weightPpg).toBeCloseTo(12.4, 1);
  });

  it('refuses a target outside the two muds', () => {
    expect(() =>
      blendToTarget({ lightPpg: 9.2, heavyPpg: 16, targetPpg: 17, lightVolumeBbl: 400 })
    ).toThrow(/not between 9.2 and 16/);
    expect(() =>
      blendToTarget({ lightPpg: 9.2, heavyPpg: 16, targetPpg: 9, lightVolumeBbl: 400 })
    ).toThrow(/not between/);
  });
});
