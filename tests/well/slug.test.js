import { describe, it, expect } from 'vitest';
import {
  dryPipeLength,
  slugVolume,
  slugPressure,
  slugJob,
  pitGainFromSlug,
} from '../../src/well/slug.js';

const pipe = { capacityBblPerFoot: 0.01776, mudPpg: 12.4, slugPpg: 15.4 };

describe('dryPipeLength', () => {
  it('works the dry pipe out for a slug volume', () => {
    expect(dryPipeLength({ slugBbl: 25, ...pipe })).toBe(340.6);
  });

  it('goes with the slug volume', () => {
    expect(dryPipeLength({ slugBbl: 50, ...pipe })).toBeCloseTo(
      dryPipeLength({ slugBbl: 25, ...pipe }) * 2,
      0
    );
  });

  it('goes with how much heavier the slug is', () => {
    const light = dryPipeLength({ slugBbl: 25, ...pipe, slugPpg: 13.4 });
    const heavy = dryPipeLength({ slugBbl: 25, ...pipe, slugPpg: 17.4 });
    expect(heavy).toBeGreaterThan(light * 2);
  });

  it('refuses a slug no heavier than the mud', () => {
    expect(() => dryPipeLength({ slugBbl: 25, ...pipe, slugPpg: 12.4 })).toThrow(
      /not heavier than a 12.4 pound mud/
    );
  });
});

describe('slugVolume', () => {
  it('inverts the dry pipe length', () => {
    const volume = slugVolume({ dryFeet: 340.6, ...pipe });
    expect(dryPipeLength({ slugBbl: volume, ...pipe })).toBeCloseTo(340.6, 0);
  });

  it('needs more of a lighter slug', () => {
    expect(slugVolume({ dryFeet: 300, ...pipe, slugPpg: 13.4 })).toBeGreaterThan(
      slugVolume({ dryFeet: 300, ...pipe, slugPpg: 17.4 })
    );
  });

  it('refuses a slug no heavier than the mud', () => {
    expect(() => slugVolume({ dryFeet: 300, ...pipe, slugPpg: 11 })).toThrow(/not heavier/);
  });
});

describe('slugPressure', () => {
  it('is the extra head the slug carries', () => {
    expect(slugPressure({ slugBbl: 25, ...pipe })).toBeGreaterThan(0);
  });

  it('is nothing for a slug the weight of the mud', () => {
    expect(slugPressure({ slugBbl: 25, ...pipe, slugPpg: 12.4 })).toBe(0);
  });
});

describe('slugJob', () => {
  const job = slugJob({ dryFeet: 300, ...pipe });

  it('works the volume, the length and the barite out together', () => {
    expect(job.slugBbl).toBeGreaterThan(0);
    expect(job.slugLengthFeet).toBeGreaterThan(0);
    expect(job.sacks).toBeGreaterThan(0);
    expect(job.agent).toBe('barite');
  });

  it('gives the same dry pipe it was asked for', () => {
    expect(dryPipeLength({ slugBbl: job.slugBbl, ...pipe })).toBeCloseTo(300, 0);
  });

  it('takes a different weighting agent', () => {
    expect(slugJob({ dryFeet: 300, ...pipe, agent: 'hematite' }).agent).toBe('hematite');
  });

  it('grows the slug volume as the barite goes in', () => {
    expect(job.volumeAfterWeightingBbl).toBeGreaterThan(job.slugBbl);
  });
});

describe('pitGainFromSlug', () => {
  it('is the pipe the slug emptied', () => {
    expect(pitGainFromSlug({ dryFeet: 300, capacityBblPerFoot: 0.01776 })).toBe(5.33);
  });

  it('refuses no dry pipe at all', () => {
    expect(() => pitGainFromSlug({ dryFeet: 0, capacityBblPerFoot: 0.01776 })).toThrow(
      /above zero/
    );
  });
});
