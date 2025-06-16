import { describe, it, expect } from 'vitest';
import { readMix, renderMix, mixCommand } from '../../src/cli/commands/mix.js';
import { run } from '../../src/cli/program.js';
import { capture } from '../support/fixtures.js';

describe('readMix', () => {
  it('works a weight up out', () => {
    const order = readMix({ job: 'weight up', fromPpg: 12.4, toPpg: 13.5, volumeBbl: 800 });
    expect(order.sacks).toBe(601);
    expect(order.volumeIncreaseBbl).toBe(40.8);
  });

  it('dumps first when the volume has to hold', () => {
    const order = readMix({
      job: 'weight up',
      fromPpg: 12.4,
      toPpg: 13.5,
      volumeBbl: 800,
      holdVolume: true,
    });
    expect(order.discardBbl).toBeGreaterThan(0);
    expect(order.finalVolumeBbl).toBeCloseTo(800, 0);
  });

  it('takes a different weighting agent', () => {
    const iron = readMix({
      job: 'weight up',
      fromPpg: 12.4,
      toPpg: 13.5,
      volumeBbl: 800,
      agent: 'hematite',
    });
    expect(iron.agent).toBe('hematite');
  });

  it('works a cut back out', () => {
    const order = readMix({ job: 'cut back', fromPpg: 12.4, toPpg: 11.5, volumeBbl: 800 });
    expect(order.addedBbl).toBe(228.2);
  });

  it('takes base oil as the dilutant on a cut back', () => {
    const oil = readMix({
      job: 'cut back',
      fromPpg: 12.4,
      toPpg: 11.5,
      volumeBbl: 800,
      dilutantPpg: 7,
    });
    expect(oil.addedBbl).toBeLessThan(228.2);
  });

  it('works a blend out', () => {
    const order = readMix({
      job: 'blend',
      fromPpg: 9.2,
      toPpg: 12.4,
      volumeBbl: 400,
      heavyPpg: 16,
    });
    expect(order.heavyVolumeBbl).toBe(355.6);
  });

  it('needs the heavy mud for a blend', () => {
    expect(() => readMix({ job: 'blend', fromPpg: 9.2, toPpg: 12.4, volumeBbl: 400 })).toThrow(
      /needs the weight of the heavy mud/
    );
  });

  it('works a dilution out', () => {
    const order = readMix({
      job: 'dilute',
      volumeBbl: 800,
      fromFraction: 0.06,
      toFraction: 0.05,
    });
    expect(order.addedBbl).toBe(160);
  });

  it('needs both fractions for a dilution', () => {
    expect(() => readMix({ job: 'dilute', volumeBbl: 800, fromFraction: 0.06 })).toThrow(
      /going from and to/
    );
  });

  it('refuses a job it does not know', () => {
    expect(() => readMix({ job: 'stir', volumeBbl: 800 })).toThrow(/no mixing job called stir/);
  });
});

describe('renderMix', () => {
  it('leads with the job', () => {
    const lines = renderMix(
      readMix({ job: 'weight up', fromPpg: 12.4, toPpg: 13.5, volumeBbl: 800 })
    );
    expect(lines[0]).toBe('MIXING ORDER WEIGHT UP');
  });

  it('spaces the field names out for reading', () => {
    const text = renderMix(
      readMix({ job: 'weight up', fromPpg: 12.4, toPpg: 13.5, volumeBbl: 800 })
    ).join('\n');
    expect(text).toContain('pounds per barrel');
    expect(text).toContain('volume increase bbl');
  });
});

describe('the command', () => {
  it('returns both the data and the page', () => {
    const result = mixCommand({ job: 'weight up', fromPpg: 12.4, toPpg: 13.5, volumeBbl: 800 });
    expect(result.data.job).toBe('weight up');
    expect(result.lines.length).toBeGreaterThan(5);
  });

  it('runs from the command line', async () => {
    const io = capture();
    const code = await run(
      ['mix', '-j', 'weight up', '--from', '12.4', '--to', '13.5', '-v', '800'],
      io
    );
    expect(code).toBe(0);
    expect(io.out.join('\n')).toContain('MIXING ORDER WEIGHT UP');
  });

  it('leaves with two on a job it does not know', async () => {
    const io = capture();
    expect(await run(['mix', '-j', 'stir', '-v', '800'], io)).toBe(1);
    expect(io.err[0]).toMatch(/no mixing job called stir/);
  });
});
