import { describe, it, expect } from 'vitest';
import {
  MOVEMENT_KINDS,
  UNITS,
  readProduct,
  readMovement,
  runStock,
  usage,
} from '../../src/inventory/stock.js';

const products = [
  {
    code: 'BAR',
    name: 'barite',
    unit: 'sack',
    unitPounds: 100,
    pricePerUnit: 16,
    category: 'weighting',
  },
  { code: 'CAU', name: 'caustic soda', unit: 'sack', unitPounds: 50, pricePerUnit: 42 },
  { code: 'PAC', name: 'polyanionic cellulose', unit: 'sack', unitPounds: 50, pricePerUnit: 96 },
];

const movements = [
  { date: '2024-09-12', code: 'BAR', kind: 'received', quantity: 400 },
  { date: '2024-09-13', code: 'BAR', kind: 'used', quantity: 260 },
  { date: '2024-09-13', code: 'CAU', kind: 'used', quantity: 8 },
  { date: '2024-09-14', code: 'PAC', kind: 'used', quantity: 12 },
  { date: '2024-09-14', code: 'BAR', kind: 'transferred', quantity: 40, note: 'to the next rig' },
];

describe('readProduct', () => {
  it('reads a price list line', () => {
    expect(readProduct(products[0])).toEqual({
      code: 'BAR',
      name: 'barite',
      unit: 'sack',
      unitPounds: 100,
      pricePerUnit: 16,
      category: 'weighting',
    });
  });

  it('defaults the category', () => {
    expect(readProduct(products[1]).category).toBe('general');
  });

  it('refuses a unit it does not know', () => {
    expect(UNITS).toContain('drum');
    expect(() => readProduct({ ...products[0], unit: 'tote' })).toThrow(/expected one of sack/);
  });

  it('refuses a missing code or price', () => {
    expect(() => readProduct({ ...products[0], code: '' })).toThrow(/product.code/);
    expect(() => readProduct({ ...products[0], pricePerUnit: undefined })).toThrow(/pricePerUnit/);
  });
});

describe('readMovement', () => {
  it('reads a movement', () => {
    expect(readMovement(movements[0]).kind).toBe('received');
  });

  it('carries the five kinds and their direction', () => {
    expect(MOVEMENT_KINDS.received).toBe(1);
    expect(MOVEMENT_KINDS.used).toBe(-1);
    expect(MOVEMENT_KINDS.lost).toBe(-1);
  });

  it('refuses a kind it does not know', () => {
    expect(() => readMovement({ ...movements[0], kind: 'spilled' })).toThrow(/expected one of/);
  });

  it('refuses a negative quantity, since the kind carries the sign', () => {
    expect(() => readMovement({ ...movements[0], quantity: -10 })).toThrow(/not be below 0/);
  });
});

describe('runStock', () => {
  const run = runStock({ products, opening: { BAR: 200, CAU: 30, PAC: 20 }, movements });

  it('carries a running balance forward', () => {
    const barite = run.movements.filter((row) => row.code === 'BAR');
    expect(barite.map((row) => row.balance)).toEqual([600, 340, 300]);
  });

  it('closes at the opening plus every movement', () => {
    const closing = Object.fromEntries(run.closing.map((row) => [row.code, row.closingQuantity]));
    expect(closing).toEqual({ BAR: 300, CAU: 22, PAC: 8 });
  });

  it('reconciles when nothing goes below zero', () => {
    expect(run.reconciles).toBe(true);
    expect(run.errors).toEqual([]);
  });

  it('reports a balance that went below zero on the day it happened', () => {
    const short = runStock({ products, opening: { BAR: 0 }, movements });
    expect(short.reconciles).toBe(false);
    expect(short.errors.join('\n')).toMatch(/2024-09-13: CAU went to -8/);
    expect(short.errors.join('\n')).toMatch(/2024-09-14: PAC went to -12/);
  });

  it('does not let a later delivery hide an earlier shortfall', () => {
    const short = runStock({
      products,
      opening: {},
      movements: [
        { date: '2024-09-10', code: 'CAU', kind: 'used', quantity: 8 },
        { date: '2024-09-11', code: 'CAU', kind: 'received', quantity: 40 },
      ],
    });
    expect(short.reconciles).toBe(false);
    expect(short.closing.find((row) => row.code === 'CAU').closingQuantity).toBe(32);
  });

  it('reads the movements in date order however they arrive', () => {
    const scrambled = runStock({
      products,
      opening: { BAR: 200 },
      movements: [movements[4], movements[1], movements[0]],
    });
    expect(scrambled.movements.map((row) => row.date)).toEqual([
      '2024-09-12',
      '2024-09-13',
      '2024-09-14',
    ]);
  });

  it('refuses a product that is on the list twice', () => {
    expect(() => runStock({ products: [...products, products[0]], movements: [] })).toThrow(
      /BAR appears twice/
    );
  });

  it('refuses a movement for something not on the list', () => {
    expect(() =>
      runStock({
        products,
        movements: [{ date: '2024-09-12', code: 'XYZ', kind: 'used', quantity: 1 }],
      })
    ).toThrow(/XYZ is not on the price list/);
  });
});

describe('usage', () => {
  const rows = usage({ products, movements });

  it('counts only what was used', () => {
    expect(rows.map((row) => row.code).sort()).toEqual(['BAR', 'CAU', 'PAC']);
    expect(rows.find((row) => row.code === 'BAR').quantity).toBe(260);
  });

  it('leaves transfers and receipts out', () => {
    const barite = rows.find((row) => row.code === 'BAR');
    expect(barite.quantity).toBe(260);
  });

  it('values each line and sorts by what it costs', () => {
    expect(rows[0].code).toBe('BAR');
    expect(rows[0].value).toBe(4160);
    expect(rows.map((row) => row.value)).toEqual(
      [...rows.map((row) => row.value)].sort((a, b) => b - a)
    );
  });

  it('weighs each line where the unit weight is known', () => {
    expect(rows.find((row) => row.code === 'CAU').pounds).toBe(400);
  });

  it('refuses a movement for something not on the list', () => {
    expect(() =>
      usage({
        products,
        movements: [{ date: '2024-09-12', code: 'XYZ', kind: 'used', quantity: 1 }],
      })
    ).toThrow(/not on the price list/);
  });
});
