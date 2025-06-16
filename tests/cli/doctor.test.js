import { describe, it, expect } from 'vitest';
import { diagnose, renderDoctor, doctorCommand } from '../../src/cli/commands/doctor.js';
import { run } from '../../src/cli/program.js';
import { capture, fixtures } from '../support/fixtures.js';

const well = fixtures.well;
const checks = fixtures.checks;
const programme = fixtures.programme;
const products = fixtures.products;
const movements = fixtures.movements;
const days = fixtures.days;

const everything = { well, checks, programme, products, movements, days };

describe('diagnose', () => {
  it('finds nothing wrong with the example set', () => {
    const result = diagnose(everything);
    expect(result.errors).toBe(0);
    expect(result.clean).toBe(true);
  });

  it('catches a check for a different well', () => {
    const result = diagnose({
      ...everything,
      checks: checks.map((check) => ({ ...check, well: 'ward 2' })),
    });
    expect(result.notes.some((row) => row.message.includes('ward 2'))).toBe(true);
    expect(result.errors).toBeGreaterThan(0);
  });

  it('catches a check below the bottom of the hole', () => {
    const result = diagnose({
      ...everything,
      checks: [...checks, { ...checks[0], depthFeet: 14000 }],
    });
    expect(result.notes.some((row) => row.message.includes('14000 ft'))).toBe(true);
  });

  it('catches a programme that stops above total depth', () => {
    const short = {
      ...programme,
      sections: [{ ...programme.sections[0] }],
    };
    const result = diagnose({ ...everything, programme: short });
    expect(result.warnings).toBeGreaterThan(0);
    expect(result.notes.some((row) => row.message.includes('the programme stops at'))).toBe(true);
  });

  it('catches a movement for a product that is not on the price list', () => {
    const result = diagnose({
      ...everything,
      movements: [...movements, { date: '2024-11-17', code: 'ZZZ', kind: 'used', quantity: 1 }],
    });
    expect(result.notes.some((row) => row.message.includes('ZZZ'))).toBe(true);
  });

  it('notes a product on the list that never moved', () => {
    const result = diagnose({
      ...everything,
      products: [...products, { code: 'NEW', name: 'a new one', unit: 'sack', pricePerUnit: 1 }],
    });
    expect(result.notes.some((row) => row.message.includes('never moved'))).toBe(true);
  });

  it('catches a day using something that is not on the price list', () => {
    const result = diagnose({
      ...everything,
      days: [...days, { date: '2024-08-20', used: { ZZZ: 1 } }],
    });
    expect(result.notes.some((row) => row.message.includes('is not on the price list'))).toBe(true);
  });

  it('catches a weight and a retort that imply a gravity no solid has', () => {
    const result = diagnose({
      checks: [
        {
          well: 'x',
          date: '2025-04-01',
          depthFeet: 9000,
          weightPpg: 15.5,
          retort: { solidsPercent: 18, oilPercent: 0, waterPercent: 82 },
        },
      ],
    });
    expect(result.notes.some((row) => row.message.includes('not a real solid'))).toBe(true);
  });

  it('says nothing about a weight and a retort that go together', () => {
    const result = diagnose({
      checks: [
        {
          well: 'x',
          date: '2025-04-01',
          depthFeet: 9000,
          weightPpg: 12.4,
          retort: { solidsPercent: 18, oilPercent: 0, waterPercent: 82 },
        },
      ],
    });
    expect(result.notes.some((row) => row.message.includes('not a real solid'))).toBe(false);
  });

  it('catches a run of copied lines', () => {
    const result = diagnose({
      checks: Array.from({ length: 8 }, (_, index) => ({
        well: 'x',
        date: `2025-04-0${index + 1}`,
        depthFeet: 9000 + index * 100,
        weightPpg: 12.4,
      })),
    });
    expect(result.notes.some((row) => row.message.includes('checks in a row'))).toBe(true);
  });

  it('runs with nothing at all', () => {
    expect(diagnose({}).notes).toEqual([]);
  });
});

describe('renderDoctor', () => {
  it('says so when the files agree', () => {
    expect(renderDoctor(diagnose(everything)).join('\n')).toContain('the files agree');
  });

  it('groups the findings by how bad they are', () => {
    const text = renderDoctor(
      diagnose({ ...everything, checks: checks.map((check) => ({ ...check, well: 'ward 2' })) })
    ).join('\n');
    expect(text).toContain('ERRORS');
  });
});

describe('the command', () => {
  it('runs from the command line', async () => {
    const io = capture();
    const code = await run(
      [
        'doctor',
        '-w',
        'examples/well-brazos.json',
        '-c',
        'examples/checks-brazos.json',
        '-p',
        'examples/programme-brazos.json',
      ],
      io
    );
    expect(code).toBe(0);
    expect(io.out.join('\n')).toContain('DOCTOR');
  });

  it('runs with nothing given at all', async () => {
    const io = capture();
    expect(await run(['doctor'], io)).toBe(0);
  });

  it('returns the data and the page', () => {
    expect(doctorCommand(everything).data.clean).toBe(true);
  });
});
