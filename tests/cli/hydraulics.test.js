import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  readHydraulics,
  renderHydraulics,
  hydraulicsCommand,
} from '../../src/cli/commands/hydraulics.js';
import { run } from '../../src/cli/program.js';

const well = JSON.parse(readFileSync('examples/well-brazos.json', 'utf8'));
const check = JSON.parse(readFileSync('examples/check-brazos.json', 'utf8'));

function capture() {
  const out = [];
  const err = [];
  return {
    out,
    err,
    print: (line) => out.push(String(line)),
    fail: (line) => err.push(String(line)),
  };
}

describe('readHydraulics', () => {
  const data = readHydraulics(well, check);

  it('works the volumes out of the hole and the string', () => {
    expect(data.volumes.annulusBbl).toBeGreaterThan(400);
    expect(data.volumes.holeVolumeBbl).toBe(
      Math.round((data.volumes.annulusBbl + data.volumes.stringBbl) * 100) / 100
    );
  });

  it('adds every loss into a standpipe pressure', () => {
    const { pressure } = data;
    expect(
      pressure.surfacePsi + pressure.stringPsi + pressure.bitPsi + pressure.annulusPsi
    ).toBeCloseTo(pressure.standpipePsi, 0);
  });

  it('reports the velocity in every length, slowest first', () => {
    expect(data.velocities).toHaveLength(3);
    expect(data.velocities[0].velocityFeetPerMinute).toBeLessThan(
      data.velocities.at(-1).velocityFeetPerMinute
    );
  });

  it('finds the slowest length in the casing, not past the collars', () => {
    expect(data.slowest.holeName).toBe('surface casing');
  });

  it('puts the circulating density above the mud weight and inside the window', () => {
    expect(data.window.ecdPpg).toBeGreaterThan(data.window.weightPpg);
    expect(data.window.breaking).toBe(false);
    expect(data.window.underbalanced).toBe(false);
  });

  it('says whether the hole is cleaning', () => {
    expect(data.cleaning.cleaning).toBe(true);
    expect(data.cleaning.transportRatio).toBeGreaterThan(0.5);
  });

  it('follows the rate it was given', () => {
    const slow = readHydraulics({ ...well, flowGpm: 300 }, check);
    expect(slow.pressure.standpipePsi).toBeLessThan(data.pressure.standpipePsi);
    expect(slow.cleaning.transportRatio).toBeLessThan(data.cleaning.transportRatio);
  });

  it('takes true vertical depth off the survey when there is one', () => {
    expect(data.tvdFeet).toBeLessThan(well.totalDepthFeet);
    expect(data.survey).toHaveLength(well.survey.length);
  });

  it('lets the survey win over a tvd typed beside it', () => {
    const wrong = readHydraulics({ ...well, tvdFeet: 5000 }, check);
    expect(wrong.tvdFeet).toBe(data.tvdFeet);
  });

  it('falls back to the typed tvd with no survey on the file', () => {
    const bare = { ...well };
    delete bare.survey;
    expect(readHydraulics(bare, check).tvdFeet).toBe(well.tvdFeet);
    expect(readHydraulics(bare, check).survey).toBe(null);
  });

  it('falls back to measured depth with neither', () => {
    const bare = { ...well };
    delete bare.survey;
    delete bare.tvdFeet;
    expect(readHydraulics(bare, check).tvdFeet).toBe(well.totalDepthFeet);
  });

  it('reads a higher circulating density on the shorter vertical depth', () => {
    const bare = { ...well };
    delete bare.survey;
    delete bare.tvdFeet;
    expect(data.window.ecdPpg).toBeGreaterThan(readHydraulics(bare, check).window.ecdPpg);
  });

  it('finds the worst dogleg on the survey', () => {
    expect(data.worstDogleg.severityPer100).toBeGreaterThan(0);
  });

  it('refuses a check with no dial readings', () => {
    expect(() => readHydraulics(well, { ...check, dials: null })).toThrow(
      /need a full set of dial readings/
    );
  });
});

describe('renderHydraulics', () => {
  const text = renderHydraulics(readHydraulics(well, check)).join('\n');

  it('prints each block', () => {
    for (const block of ['PRESSURE', 'ANNULAR VELOCITY', 'DENSITY WINDOW', 'HOLE CLEANING']) {
      expect(text).toContain(block);
    }
  });

  it('prints both depths, so nobody works a hydrostatic off the wrong one', () => {
    expect(text).toMatch(/measured depth\s+10450 ft/);
    expect(text).toMatch(/true vertical depth\s+\d+/);
  });

  it('names the length the hole cleans worst in', () => {
    expect(text).toMatch(/slowest annulus\s+291\.9 ft\/min in the surface casing/);
  });

  it('closes with the bottoms up', () => {
    expect(text.trim().split('\n').at(-1)).toMatch(/bottoms up \d+ strokes/);
  });
});

describe('the command', () => {
  it('returns both the data and the page', () => {
    const result = hydraulicsCommand(well, check);
    expect(result.data.well).toBe('brazos 14-3');
    expect(result.lines.length).toBeGreaterThan(20);
  });

  it('runs from the command line', async () => {
    const io = capture();
    const code = await run(
      ['hydraulics', '-w', 'examples/well-brazos.json', '-c', 'examples/check-brazos.json'],
      io
    );
    expect(code).toBe(0);
    expect(io.out.join('\n')).toContain('HYDRAULICS BRAZOS 14-3');
  });

  it('takes a rate off the command line', async () => {
    const io = capture();
    await run(
      [
        'hydraulics',
        '-w',
        'examples/well-brazos.json',
        '-c',
        'examples/check-brazos.json',
        '-r',
        '400',
        '-f',
        'json',
      ],
      io
    );
    expect(JSON.parse(io.out[0]).flowGpm).toBe(400);
  });

  it('leaves with two on a well file that is not there', async () => {
    const io = capture();
    expect(
      await run(['hydraulics', '-w', 'nowhere.json', '-c', 'examples/check-brazos.json'], io)
    ).toBe(2);
  });
});
