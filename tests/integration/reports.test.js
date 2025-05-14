import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { run } from '../../src/cli/program.js';
import { readChecks } from '../../src/mudcheck/record.js';
import { readProgramme } from '../../src/program/window.js';
import { buildDaily } from '../../src/report/daily.js';
import { buildRecap } from '../../src/report/recap.js';
import { buildSectionReport } from '../../src/report/section.js';
import { buildMorning } from '../../src/report/morning.js';
import { dayCost } from '../../src/cost/daily.js';

const check = JSON.parse(readFileSync('examples/check-brazos.json', 'utf8'));
const rawChecks = JSON.parse(readFileSync('examples/checks-brazos.json', 'utf8'));
const rawProgramme = JSON.parse(readFileSync('examples/programme-brazos.json', 'utf8'));
const rawDays = JSON.parse(readFileSync('examples/days-brazos.json', 'utf8'));
const products = JSON.parse(readFileSync('examples/products.json', 'utf8'));

const checks = readChecks(rawChecks);
const programme = readProgramme(rawProgramme);
const days = rawDays.map((day) =>
  dayCost({
    date: day.date,
    products,
    used: day.used ?? {},
    footageFeet: day.footageFeet ?? 0,
    mudBuiltBbl: day.mudBuiltBbl ?? 0,
    serviceCharge: day.serviceCharge ?? 0,
    rentalCharge: day.rentalCharge ?? 0,
    haulageCharge: day.haulageCharge ?? 0,
  })
);

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

describe('every report agrees with every other', () => {
  const daily = buildDaily({ well: 'brazos 14-3', date: '2024-08-19', check, programme });
  const recap = buildRecap({ well: 'brazos 14-3', checks, programme, days });
  const section = buildSectionReport({
    section: programme.sections[1],
    checks,
    programme,
    days,
  });
  const morning = buildMorning({
    well: 'brazos 14-3',
    date: '2024-08-19',
    check,
    programme,
  });

  it('reports the same depth on the daily, the morning and the recap', () => {
    expect(daily.check.depthFeet).toBe(morning.depthFeet);
    expect(recap.toDepthFeet).toBe(morning.depthFeet);
  });

  it('reports the same weight everywhere', () => {
    expect(daily.check.weightPpg).toBe(morning.weightPpg);
    expect(recap.weight.end).toBe(morning.weightPpg);
    expect(section.weight.end).toBe(morning.weightPpg);
  });

  it('reports the same rheology on the daily and the morning', () => {
    expect(daily.rheology.plasticViscosity).toBe(morning.plasticViscosity);
    expect(daily.rheology.yieldPoint).toBe(morning.yieldPoint);
  });

  it('judges against the same section', () => {
    expect(daily.compliance.section).toBe(morning.section);
    expect(section.section).toBe(morning.section);
  });

  it('counts the same checks in the recap and the section', () => {
    expect(recap.checks).toBe(section.checks);
  });

  it('totals the same cost in the recap and the section', () => {
    expect(recap.costs.totalCost).toBe(section.costs.totalCost);
  });

  it('finds the same exceptions in the recap and the section', () => {
    expect(recap.exceptions.outside).toBe(section.exceptions.outside);
  });
});

describe('every command runs against the same file set', () => {
  const cases = [
    ['check', '-c', 'examples/check-brazos.json'],
    ['hydraulics', '-w', 'examples/well-brazos.json', '-c', 'examples/check-brazos.json'],
    ['daily', '-d', 'examples/day-brazos.json', '-c', 'examples/check-brazos.json'],
    ['programme', '-p', 'examples/programme-brazos.json'],
    ['recap', '-c', 'examples/checks-brazos.json'],
    ['morning', '-c', 'examples/checks-brazos.json'],
    ['pits', '-p', 'examples/pits-brazos.json'],
    ['trip', '-t', 'examples/trip-brazos.json'],
    ['kill', '-k', 'examples/kill-brazos.json'],
    ['solids', '-s', 'examples/solids-control.json'],
    ['doctor', '-c', 'examples/checks-brazos.json'],
    [
      'section',
      '-s',
      'intermediate',
      '-c',
      'examples/checks-brazos.json',
      '-p',
      'examples/programme-brazos.json',
    ],
  ];

  it('leaves with nothing and prints something every time', async () => {
    for (const argv of cases) {
      const io = capture();
      const code = await run(argv, io);
      expect(`${argv[0]} -> ${code} ${io.err.join(' ')}`).toBe(`${argv[0]} -> 0 `);
      expect(io.out.join('').length).toBeGreaterThan(20);
    }
  });

  it('produces valid json from every reporting command', async () => {
    for (const argv of cases) {
      const io = capture();
      await run([...argv, '-f', 'json'], io);
      expect(() => JSON.parse(io.out[0])).not.toThrow();
    }
  });

  it('never writes anything unless it was asked to', async () => {
    for (const argv of cases) {
      const io = capture();
      await run(argv, io);
      expect(io.out.join('\n')).not.toContain('written to');
    }
  });
});
