import { describe, it, expect } from 'vitest';
import { TOLERANCE, auditLine, audit, auditValue, adjustments } from '../../src/inventory/audit.js';

const book = [
  { code: 'BAR', name: 'barite', unit: 'sack', closingQuantity: 160 },
  { code: 'CAU', name: 'caustic soda', unit: 'sack', closingQuantity: 22 },
  { code: 'PAC', name: 'polyanionic cellulose', unit: 'sack', closingQuantity: 8 },
];

const products = [
  { code: 'BAR', pricePerUnit: 16 },
  { code: 'CAU', pricePerUnit: 42 },
  { code: 'PAC', pricePerUnit: 96 },
];

describe('auditLine', () => {
  it('is inside tolerance on a small difference', () => {
    const line = auditLine({ code: 'BAR', book: 160, counted: 159 });
    expect(line.withinTolerance).toBe(true);
    expect(line.difference).toBe(-1);
  });

  it('is outside it on a large one', () => {
    expect(auditLine({ code: 'BAR', book: 160, counted: 120 }).withinTolerance).toBe(false);
  });

  it('allows more slack on a big number than a small one', () => {
    expect(TOLERANCE.fraction).toBe(0.02);
    expect(auditLine({ code: 'BAR', book: 400, counted: 393 }).withinTolerance).toBe(true);
    expect(auditLine({ code: 'PAC', book: 8, counted: 1 }).withinTolerance).toBe(false);
  });

  it('flags a difference that is whole pallets', () => {
    const line = auditLine({ code: 'BAR', book: 160, counted: 120, palletUnits: 40 });
    expect(line.looksLikePaperwork).toBe(true);
  });

  it('does not flag one that is not', () => {
    expect(
      auditLine({ code: 'BAR', book: 160, counted: 123, palletUnits: 40 }).looksLikePaperwork
    ).toBe(false);
  });

  it('has no share to report against an empty book', () => {
    expect(auditLine({ code: 'BAR', book: 0, counted: 4 }).differenceShare).toBe(null);
  });

  it('names the product in the failure', () => {
    expect(() => auditLine({ code: 'BAR', book: -1, counted: 4 })).toThrow(/BAR book/);
  });
});

describe('audit', () => {
  it('is clean when every count matches', () => {
    const result = audit({ book, counted: { BAR: 160, CAU: 22, PAC: 8 } });
    expect(result.clean).toBe(true);
    expect(result.outOfTolerance).toBe(0);
  });

  it('sorts the biggest difference first', () => {
    const result = audit({ book, counted: { BAR: 120, CAU: 21, PAC: 8 } });
    expect(result.lines[0].code).toBe('BAR');
  });

  it('counts a product that was not counted as zero', () => {
    const result = audit({ book, counted: { BAR: 160, CAU: 22 } });
    expect(result.lines.find((line) => line.code === 'PAC').counted).toBe(0);
    expect(result.clean).toBe(false);
  });

  it('reports something on the rack that is not on the book', () => {
    const result = audit({ book, counted: { BAR: 160, CAU: 22, PAC: 8, XCD: 4 } });
    expect(result.notOnTheBook).toEqual(['XCD']);
    expect(result.clean).toBe(false);
  });

  it('reads the pallet size where one is given', () => {
    const result = audit({ book, counted: { BAR: 120, CAU: 22, PAC: 8 }, pallets: { BAR: 40 } });
    expect(result.lines[0].looksLikePaperwork).toBe(true);
  });
});

describe('auditValue', () => {
  const result = audit({ book, counted: { BAR: 120, CAU: 24, PAC: 8 } });

  it('values the short and the over separately', () => {
    const valued = auditValue({ lines: result.lines, products });
    expect(valued.shortValue).toBe(-640);
    expect(valued.overValue).toBe(84);
    expect(valued.netValue).toBe(-556);
  });

  it('values every line', () => {
    const valued = auditValue({ lines: result.lines, products });
    expect(valued.lines).toHaveLength(3);
  });

  it('refuses a product that is not on the price list', () => {
    expect(() => auditValue({ lines: result.lines, products: products.slice(0, 1) })).toThrow(
      /not on the price list/
    );
  });
});

describe('adjustments', () => {
  it('writes a movement for every difference', () => {
    const moves = adjustments(audit({ book, counted: { BAR: 120, CAU: 24, PAC: 8 } }));
    expect(moves).toHaveLength(2);
    expect(moves.find((move) => move.code === 'BAR').kind).toBe('lost');
    expect(moves.find((move) => move.code === 'CAU').kind).toBe('received');
  });

  it('writes nothing at all for a clean count', () => {
    expect(adjustments(audit({ book, counted: { BAR: 160, CAU: 22, PAC: 8 } }))).toEqual([]);
  });

  it('says to look at the paperwork on a whole pallet difference', () => {
    const moves = adjustments(
      audit({ book, counted: { BAR: 120, CAU: 22, PAC: 8 }, pallets: { BAR: 40 } })
    );
    expect(moves[0].note).toMatch(/paperwork/);
  });
});
