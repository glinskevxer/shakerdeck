import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readKill, renderKill, killCommand } from '../../src/cli/commands/kill.js';
import { run } from '../../src/cli/program.js';

const input = JSON.parse(readFileSync('examples/kill-brazos.json', 'utf8'));

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

describe('readKill', () => {
  const data = readKill({ ...input, systemBbl: 800 });

  it('works the kill mud weight out', () => {
    expect(data.killPpg).toBeGreaterThan(data.currentPpg);
    expect(data.weightUpPpg).toBeCloseTo(data.killPpg - data.currentPpg, 2);
  });

  it('runs the schedule from the initial to the final pressure', () => {
    expect(data.schedule[0].standpipePsi).toBe(data.initialPsi);
    expect(data.schedule.at(-1).standpipePsi).toBe(data.finalPsi);
  });

  it('says what the influx looks like', () => {
    expect(['gas', 'oil', 'salt water']).toContain(data.influx.kind);
  });

  it('works the barite out when the system volume is given', () => {
    expect(data.barite.sacks).toBeGreaterThan(0);
    expect(data.barite.agent).toBe('barite');
  });

  it('leaves the barite out when it is not', () => {
    expect(readKill(input).barite).toBe(null);
  });

  it('takes a different weighting agent', () => {
    expect(readKill({ ...input, systemBbl: 800, agent: 'hematite' }).barite.agent).toBe('hematite');
  });

  it('needs no weight up when the well is dead', () => {
    const dead = readKill({ ...input, shutInDrillPipePsi: 0, systemBbl: 800 });
    expect(dead.killPpg).toBe(dead.currentPpg);
    expect(dead.barite).toBe(null);
  });
});

describe('renderKill', () => {
  const text = renderKill(readKill({ ...input, systemBbl: 800 })).join('\n');

  it('prints each block', () => {
    for (const block of ['KILL SHEET', 'THE INFLUX', 'THE SHOE', 'STEP DOWN SCHEDULE']) {
      expect(text).toContain(block);
    }
  });

  it('prints the barite block when the system volume was given', () => {
    expect(text).toContain('BUILDING THE KILL MUD');
  });

  it('leaves it out when it was not', () => {
    expect(renderKill(readKill(input)).join('\n')).not.toContain('BUILDING THE KILL MUD');
  });

  it('says so when the mud is already at the leak off', () => {
    const over = renderKill(readKill({ ...input, leakOffPpg: 12 })).join('\n');
    expect(over).toContain('already at the leak off');
  });
});

describe('the command', () => {
  it('runs from the command line', async () => {
    const io = capture();
    expect(await run(['kill', '-k', 'examples/kill-brazos.json'], io)).toBe(0);
    expect(io.out.join('\n')).toContain('KILL SHEET');
  });

  it('takes the system volume off the command line', async () => {
    const io = capture();
    await run(['kill', '-k', 'examples/kill-brazos.json', '--system', '800', '-f', 'json'], io);
    expect(JSON.parse(io.out[0]).barite.sacks).toBeGreaterThan(0);
  });

  it('returns the data and the page', () => {
    expect(killCommand(input).data.well).toBe('brazos 14-3');
  });
});
