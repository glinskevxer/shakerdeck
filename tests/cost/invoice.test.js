import { describe, it, expect } from 'vitest';
import { fixtures } from '../support/fixtures.js';
import {
  productLines,
  serviceLines,
  buildInvoice,
  reconcileInvoice,
  invoiceSplit,
} from '../../src/cost/invoice.js';

const products = fixtures.products;
const movements = fixtures.movements;
const rentals = [
  { code: 'CENT', description: 'decanting centrifuge', ratePerDay: 450 },
  { code: 'MIX', description: 'mixing plant', ratePerDay: 180, days: 4 },
];

const invoice = buildInvoice({
  number: 'MI-2025-0114',
  well: 'brazos 14-3',
  from: '2024-11-12',
  to: '2024-11-16',
  products,
  movements,
  days: 5,
  serviceRatePerDay: 1450,
  rentals,
  taxShare: 0.08,
});

describe('productLines', () => {
  const lines = productLines({ products, movements });

  it('bills only what was used', () => {
    expect(lines.every((line) => line.kind === 'product')).toBe(true);
    expect(lines.find((line) => line.code === 'BAR').quantity).toBe(400);
  });

  it('carries the rate the value was worked at', () => {
    const barite = lines.find((line) => line.code === 'BAR');
    expect(barite.rate).toBe(16);
    expect(barite.value).toBe(6400);
  });

  it('bills nothing when nothing was used', () => {
    expect(productLines({ products, movements: [] })).toEqual([]);
  });
});

describe('serviceLines', () => {
  it('bills the service at the day rate', () => {
    const lines = serviceLines({ days: 5, serviceRatePerDay: 1450 });
    expect(lines[0].value).toBe(7250);
    expect(lines[0].kind).toBe('service');
  });

  it('bills each rental for the days it was on hire', () => {
    const lines = serviceLines({ days: 5, serviceRatePerDay: 1450, rentals });
    expect(lines.find((line) => line.code === 'MIX').quantity).toBe(4);
    expect(lines.find((line) => line.code === 'CENT').quantity).toBe(5);
  });

  it('names the rental whose rate is wrong', () => {
    expect(() =>
      serviceLines({ days: 5, serviceRatePerDay: 1450, rentals: [{ code: 'CENT' }] })
    ).toThrow(/CENT ratePerDay/);
  });

  it('refuses an invoice for no days', () => {
    expect(() => serviceLines({ days: 0, serviceRatePerDay: 1450 })).toThrow(/above zero/);
  });
});

describe('buildInvoice', () => {
  it('adds the product, service and rental lines together', () => {
    expect(invoice.lines.length).toBeGreaterThan(5);
    expect(invoice.gross).toBeCloseTo(
      invoice.lines.reduce((total, line) => total + line.value, 0),
      2
    );
  });

  it('puts tax on the net', () => {
    expect(invoice.tax).toBeCloseTo(invoice.net * 0.08, 1);
    expect(invoice.total).toBeCloseTo(invoice.net + invoice.tax, 2);
  });

  it('takes a discount off the gross before the tax', () => {
    const discounted = buildInvoice({
      number: 'x',
      well: 'x',
      products,
      movements,
      days: 5,
      serviceRatePerDay: 1450,
      discountShare: 0.1,
      taxShare: 0.08,
    });
    expect(discounted.net).toBeCloseTo(discounted.gross * 0.9, 1);
    expect(discounted.tax).toBeLessThan(invoice.tax);
  });

  it('carries the well and the period for the header', () => {
    expect(invoice.well).toBe('brazos 14-3');
    expect(invoice.from).toBe('2024-11-12');
  });
});

describe('reconcileInvoice', () => {
  it('agrees with day totals that add up to the same thing', () => {
    const check = reconcileInvoice({
      invoice,
      dayTotals: [{ total: invoice.gross }],
    });
    expect(check.withinTolerance).toBe(true);
    expect(check.difference).toBe(0);
  });

  it('disagrees when they do not', () => {
    const check = reconcileInvoice({ invoice, dayTotals: [{ total: invoice.gross * 0.8 }] });
    expect(check.withinTolerance).toBe(false);
    expect(check.difference).toBeGreaterThan(0);
  });

  it('allows a rounding difference', () => {
    const check = reconcileInvoice({ invoice, dayTotals: [{ total: invoice.gross - 1 }] });
    expect(check.withinTolerance).toBe(true);
  });
});

describe('invoiceSplit', () => {
  it('splits the invoice by what each line is for', () => {
    const split = invoiceSplit(invoice);
    expect(split.map((row) => row.kind).sort()).toEqual(['product', 'rental', 'service']);
    expect(split.reduce((total, row) => total + row.share, 0)).toBeCloseTo(1, 2);
  });

  it('sorts by what each is worth', () => {
    const values = invoiceSplit(invoice).map((row) => row.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('handles an invoice worth nothing', () => {
    expect(invoiceSplit({ lines: [], gross: 0 })).toEqual([]);
  });
});
