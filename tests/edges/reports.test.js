import { describe, it, expect } from 'vitest';
import { capture, fixtures } from '../support/fixtures.js';
import { run } from '../../src/cli/program.js';
import { buildDaily, renderDaily } from '../../src/report/daily.js';
import { buildRecap, renderRecap } from '../../src/report/recap.js';
import { buildMorning, renderMorning } from '../../src/report/morning.js';
import { readChecks } from '../../src/mudcheck/record.js';

const bare = {
  well: 'ward 2',
  date: '2025-07-28',
  depthFeet: 4000,
  weightPpg: 9.4,
};

describe('a report on a check with almost nothing on it', () => {
  it('still prints a daily report', () => {
    const lines = renderDaily(buildDaily({ well: 'ward 2', date: bare.date, check: bare }));
    expect(lines.length).toBeGreaterThan(6);
    expect(lines.join('\n')).toContain('MUD PROPERTIES');
  });

  it('still prints a morning report of four lines', () => {
    expect(
      renderMorning(buildMorning({ well: 'ward 2', date: bare.date, check: bare }))
    ).toHaveLength(4);
  });

  it('says what was not measured rather than printing a zero', () => {
    const text = renderDaily(buildDaily({ well: 'ward 2', date: bare.date, check: bare })).join(
      '\n'
    );
    expect(text).not.toContain('0 cP');
    expect(text).not.toMatch(/plastic viscosity/);
  });
});

describe('a recap of the shortest run there can be', () => {
  const two = readChecks([bare, { ...bare, date: '2025-07-29', depthFeet: 4400, weightPpg: 9.5 }]);

  it('builds off two checks', () => {
    const recap = buildRecap({ well: 'ward 2', checks: two });
    expect(recap.checks).toBe(2);
    expect(recap.control).toBe(null);
  });

  it('says there are not enough checks to chart', () => {
    expect(renderRecap(buildRecap({ well: 'ward 2', checks: two })).join('\n')).toContain(
      'not enough checks'
    );
  });

  it('builds off a single check', () => {
    const one = buildRecap({ well: 'ward 2', checks: [bare] });
    expect(one.checks).toBe(1);
    expect(one.days).toBe(1);
    expect(one.movers).toEqual([]);
  });
});

describe('a run of checks all on the same day', () => {
  const sameDay = readChecks([
    { ...bare, depthFeet: 4000 },
    { ...bare, depthFeet: 4200 },
    { ...bare, depthFeet: 4400 },
  ]);

  it('sorts them by depth', () => {
    expect(sameDay.map((check) => check.depthFeet)).toEqual([4000, 4200, 4400]);
  });

  it('counts the run as one day', () => {
    expect(buildRecap({ well: 'ward 2', checks: sameDay }).days).toBe(1);
  });

  it('finds no gap in the dates', () => {
    expect(buildRecap({ well: 'ward 2', checks: sameDay }).missingCheckDays).toEqual([]);
  });
});

describe('a report asked for a well with nothing on it', () => {
  it('refuses a recap of no checks', () => {
    expect(() => buildRecap({ well: 'ward 2', checks: [] })).toThrow(/at least one mud check/);
  });

  it('leaves with two rather than throwing out of the command line', async () => {
    const io = capture();
    const code = await run(['recap', '-c', 'examples/products.json'], io);
    expect(code).toBe(2);
    expect(io.errors().length).toBeGreaterThan(0);
  });
});

describe('a report written to a file', () => {
  it('writes the same page it would have printed', async () => {
    const printed = capture();
    await run(['check', '-c', 'examples/check-brazos.json'], printed);
    expect(printed.text()).toContain('MUD CHECK');
  });

  it('says where it wrote it', async () => {
    const io = capture();
    await run(['check', '-c', 'examples/check-brazos.json', '-o', '/tmp/shakerdeck-edge.txt'], io);
    expect(io.text()).toContain('written to /tmp/shakerdeck-edge.txt');
  });
});

describe('every reporting command against the barest possible inputs', () => {
  it('never throws out of the command line', async () => {
    const cases = [
      ['check', '-c', 'examples/check-ward.json'],
      ['recap', '-c', 'examples/checks-brazos.json'],
      ['morning', '-c', 'examples/checks-brazos.json'],
      ['doctor'],
      ['commands'],
    ];
    for (const argv of cases) {
      const io = capture();
      const code = await run(argv, io);
      expect(`${argv[0]} -> ${code}`).toBe(`${argv[0]} -> 0`);
    }
  });

  it('reads every example the fixtures carry', () => {
    for (const [name, value] of Object.entries(fixtures)) {
      expect(`${name}: ${value === null || value === undefined}`).toBe(`${name}: false`);
    }
  });
});
