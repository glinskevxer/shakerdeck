import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { daysInSection, sectionCommand } from '../../src/cli/commands/section.js';
import { run } from '../../src/cli/program.js';

const checks = JSON.parse(readFileSync('examples/checks-brazos.json', 'utf8'));
const programme = JSON.parse(readFileSync('examples/programme-brazos.json', 'utf8'));
const days = JSON.parse(readFileSync('examples/days-brazos.json', 'utf8'));
const products = JSON.parse(readFileSync('examples/products.json', 'utf8'));
const treatments = JSON.parse(readFileSync('examples/treatments.json', 'utf8'));

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

describe('daysInSection', () => {
  it('takes only the days between the two dates', () => {
    const valued = daysInSection({ days, products, from: '2024-08-16', to: '2024-08-18' });
    expect(valued.map((day) => day.date)).toEqual(['2024-08-16', '2024-08-17', '2024-08-18']);
  });

  it('is nothing with no price list to value them against', () => {
    expect(daysInSection({ days, products: null, from: '2024-08-14', to: '2024-08-19' })).toEqual(
      []
    );
  });

  it('is nothing when no day falls in the window', () => {
    expect(daysInSection({ days, products, from: '2025-01-01', to: '2025-01-02' })).toEqual([]);
  });
});

describe('sectionCommand', () => {
  it('reports the section', () => {
    const result = sectionCommand({ name: 'intermediate', checks, programme });
    expect(result.data.section).toBe('intermediate');
    expect(result.lines[0]).toContain('SECTION REPORT INTERMEDIATE');
  });

  it('compares against the plan when the treatments are given', () => {
    const result = sectionCommand({
      name: 'intermediate',
      checks,
      programme,
      days,
      products,
      treatments,
    });
    expect(result.data.againstPlan).not.toBe(null);
    expect(result.data.againstPlan.plannedPerFoot).toBeGreaterThan(0);
  });

  it('leaves the comparison out without them', () => {
    const result = sectionCommand({ name: 'intermediate', checks, programme, days, products });
    expect(result.data.againstPlan).toBe(null);
  });

  it('refuses a section that is not in the programme', () => {
    expect(() => sectionCommand({ name: 'production', checks, programme })).toThrow(
      /no section called production/
    );
  });

  it('runs from the command line', async () => {
    const io = capture();
    const code = await run(
      [
        'section',
        '-s',
        'intermediate',
        '-c',
        'examples/checks-brazos.json',
        '-p',
        'examples/programme-brazos.json',
      ],
      io
    );
    expect(code).toBe(0);
    expect(io.out.join('\n')).toContain('SECTION REPORT');
  });

  it('leaves with one on a section that is not there', async () => {
    const io = capture();
    expect(
      await run(
        [
          'section',
          '-s',
          'production',
          '-c',
          'examples/checks-brazos.json',
          '-p',
          'examples/programme-brazos.json',
        ],
        io
      )
    ).toBe(1);
  });
});
