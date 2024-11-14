import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { valueDays, recapCommand } from '../../src/cli/commands/recap.js';
import { run } from '../../src/cli/program.js';

const checks = JSON.parse(readFileSync('examples/checks-brazos.json', 'utf8'));
const programme = JSON.parse(readFileSync('examples/programme-brazos.json', 'utf8'));
const days = JSON.parse(readFileSync('examples/days-brazos.json', 'utf8'));
const products = JSON.parse(readFileSync('examples/products.json', 'utf8'));

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

describe('valueDays', () => {
  it('values every day off the price list', () => {
    const valued = valueDays(days, products);
    expect(valued).toHaveLength(days.length);
    expect(valued[0].total).toBeGreaterThan(0);
  });

  it('is nothing at all with no price list', () => {
    expect(valueDays(days, null)).toEqual([]);
  });

  it('handles a day that used nothing', () => {
    const valued = valueDays([{ date: '2024-08-20', footageFeet: 0 }], products);
    expect(valued[0].total).toBe(0);
    expect(valued[0].costPerFoot).toBe(null);
  });

  it('names a price list line that is wrong', () => {
    expect(() => valueDays(days, [{ code: 'BAR', name: 'barite', unit: 'sack' }])).toThrow(
      /pricePerUnit/
    );
  });
});

describe('recapCommand', () => {
  it('builds the whole recap', () => {
    const result = recapCommand({ well: 'brazos 14-3', checks, programme, days, products });
    expect(result.data.checks).toBe(6);
    expect(result.data.costs.totalFootage).toBe(2970);
    expect(result.lines.join('\n')).toContain('WELL RECAP BRAZOS 14-3');
  });

  it('runs with nothing but the checks', () => {
    const result = recapCommand({ well: 'brazos 14-3', checks });
    expect(result.data.costs).toBe(null);
    expect(result.data.exceptions).toBe(null);
  });

  it('runs from the command line', async () => {
    const io = capture();
    const code = await run(
      [
        'recap',
        '-c',
        'examples/checks-brazos.json',
        '-p',
        'examples/programme-brazos.json',
        '-d',
        'examples/days-brazos.json',
        '-P',
        'examples/products.json',
      ],
      io
    );
    expect(code).toBe(0);
    expect(io.out.join('\n')).toContain('WELL RECAP');
  });

  it('takes the well name off the first check when none is given', async () => {
    const io = capture();
    await run(['recap', '-c', 'examples/checks-brazos.json'], io);
    expect(io.out.join('\n')).toContain('BRAZOS 14-3');
  });
});
