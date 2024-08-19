import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readDay, dailyCommand } from '../../src/cli/commands/daily.js';
import { run } from '../../src/cli/program.js';

const day = JSON.parse(readFileSync('examples/day-brazos.json', 'utf8'));
const check = JSON.parse(readFileSync('examples/check-brazos.json', 'utf8'));
const programme = JSON.parse(readFileSync('examples/programme-brazos.json', 'utf8'));
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

describe('readDay', () => {
  it('values the day off the price list', () => {
    const data = readDay({ day, check, programme, products });
    expect(data.costs.productCost).toBe(5648);
    expect(data.costs.costPerFoot).toBe(9.05);
  });

  it('judges the check against the programme', () => {
    expect(readDay({ day, check, programme, products }).compliance.section).toBe('intermediate');
  });

  it('leaves the cost out with no price list', () => {
    const data = readDay({ day, check, programme });
    expect(data.costs).toBe(null);
    expect(data.products).toEqual([]);
  });

  it('leaves the compliance out with no programme', () => {
    expect(readDay({ day, check, products }).compliance).toBe(null);
  });

  it('carries the activity through', () => {
    expect(readDay({ day, check }).activity).toHaveLength(3);
  });

  it('refuses a price list with a bad line', () => {
    expect(() =>
      readDay({
        day,
        check,
        products: [{ code: 'BAR', name: 'barite', unit: 'tote', pricePerUnit: 1 }],
      })
    ).toThrow(/products\[0\].unit/);
  });
});

describe('dailyCommand', () => {
  it('returns the page and the summary', () => {
    const result = dailyCommand({ day, check, programme, products });
    expect(result.lines.length).toBeGreaterThan(25);
    expect(result.summary).toContain('in window');
  });

  it('runs from the command line', async () => {
    const io = capture();
    const code = await run(
      [
        'daily',
        '-d',
        'examples/day-brazos.json',
        '-c',
        'examples/check-brazos.json',
        '-p',
        'examples/programme-brazos.json',
        '-P',
        'examples/products.json',
      ],
      io
    );
    expect(code).toBe(0);
    expect(io.out.join('\n')).toContain('DAILY MUD REPORT BRAZOS 14-3');
  });

  it('prints the one line summary when asked', async () => {
    const io = capture();
    await run(
      ['daily', '-d', 'examples/day-brazos.json', '-c', 'examples/check-brazos.json', '--summary'],
      io
    );
    expect(io.out).toHaveLength(1);
    expect(io.out[0]).toContain('10450 ft');
  });

  it('runs with nothing but the day and the check', async () => {
    const io = capture();
    expect(
      await run(['daily', '-d', 'examples/day-brazos.json', '-c', 'examples/check-brazos.json'], io)
    ).toBe(0);
  });
});
