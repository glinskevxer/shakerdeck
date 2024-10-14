import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  usageHistory,
  readStock,
  renderStock,
  stockCommand,
} from '../../src/cli/commands/stock.js';
import { run } from '../../src/cli/program.js';

const products = JSON.parse(readFileSync('examples/products.json', 'utf8'));
const movements = JSON.parse(readFileSync('examples/movements.json', 'utf8'));
const opening = JSON.parse(readFileSync('examples/opening-stock.json', 'utf8'));

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

describe('usageHistory', () => {
  const history = usageHistory(movements);

  it('gives every product a row of the same length', () => {
    const lengths = new Set(Object.values(history).map((days) => days.length));
    expect(lengths.size).toBe(1);
  });

  it('counts a day with no use as a zero rather than dropping it', () => {
    expect(history.CAU.filter((day) => day === 0).length).toBeGreaterThan(0);
  });

  it('leaves receipts and transfers out', () => {
    expect(history.BAR.reduce((sum, day) => sum + day, 0)).toBe(400);
  });

  it('adds two uses on the same day together', () => {
    const same = usageHistory([
      { date: '2024-11-12', code: 'BAR', kind: 'used', quantity: 40 },
      { date: '2024-11-12', code: 'BAR', kind: 'used', quantity: 60 },
    ]);
    expect(same.BAR).toEqual([100]);
  });
});

describe('readStock', () => {
  const data = readStock({ products, opening, movements });

  it('closes each product where the movements leave it', () => {
    const closing = Object.fromEntries(
      data.run.closing.map((row) => [row.code, row.closingQuantity])
    );
    expect(closing.BAR).toBe(160);
    expect(closing.PAC).toBe(2);
  });

  it('reconciles when nothing went below zero', () => {
    expect(data.run.reconciles).toBe(true);
  });

  it('values what was used', () => {
    expect(data.used[0].code).toBe('BAR');
    expect(data.used[0].value).toBe(6400);
  });

  it('orders the products that are short, tightest cover first', () => {
    expect(data.reorder[0].code).toBe('PAC');
    expect(data.reorder[0].order).toBeGreaterThan(0);
  });

  it('orders nothing for a product with plenty of cover', () => {
    expect(data.reorder.find((row) => row.code === 'CAU').order).toBe(0);
  });

  it('does not reconcile when the opening stock was too small', () => {
    expect(readStock({ products, opening: {}, movements }).run.reconciles).toBe(false);
  });
});

describe('renderStock', () => {
  const text = renderStock(readStock({ products, opening, movements })).join('\n');

  it('prints each block', () => {
    for (const block of ['PRODUCT STOCK', 'USED', 'ORDERING']) {
      expect(text).toContain(block);
    }
  });

  it('says the stock reconciles', () => {
    expect(text).toMatch(/reconciles\s+yes/);
  });

  it('lists the errors when it does not', () => {
    const broken = renderStock(readStock({ products, opening: {}, movements })).join('\n');
    expect(broken).toContain('THE STOCK DOES NOT RECONCILE');
    expect(broken).toMatch(/cannot happen/);
  });
});

describe('the command', () => {
  it('returns the data and the page', () => {
    const result = stockCommand({ products, opening, movements });
    expect(result.lines.join('\n').split('\n').length).toBeGreaterThan(20);
  });

  it('runs from the command line', async () => {
    const io = capture();
    const code = await run(
      [
        'stock',
        '-P',
        'examples/products.json',
        '-m',
        'examples/movements.json',
        '-b',
        'examples/opening-stock.json',
      ],
      io
    );
    expect(code).toBe(0);
    expect(io.out.join('\n')).toContain('PRODUCT STOCK');
  });

  it('runs with no opening stock at all', async () => {
    const io = capture();
    expect(
      await run(['stock', '-P', 'examples/products.json', '-m', 'examples/movements.json'], io)
    ).toBe(0);
  });
});
