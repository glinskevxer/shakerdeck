import { describe, it, expect } from 'vitest';
import {
  burnRate,
  daysOfCover,
  reorderPoint,
  orderQuantity,
  reorderReport,
} from '../../src/inventory/reorder.js';

const stock = [
  { code: 'BAR', name: 'barite', unit: 'sack', closingQuantity: 300 },
  { code: 'CAU', name: 'caustic soda', unit: 'sack', closingQuantity: 22 },
  { code: 'PAC', name: 'polyanionic cellulose', unit: 'sack', closingQuantity: 8 },
  { code: 'LCM', name: 'medium nut plug', unit: 'sack', closingQuantity: 60 },
];

const history = {
  BAR: [120, 90, 260, 140],
  CAU: [6, 8, 8, 10],
  PAC: [10, 12, 12, 14],
  LCM: [0, 0, 0, 0],
};

describe('burnRate', () => {
  it('averages the days given', () => {
    expect(burnRate([10, 20, 30])).toBe(20);
  });

  it('counts a day of no use', () => {
    expect(burnRate([10, 0, 20])).toBe(10);
  });

  it('refuses an empty history', () => {
    expect(() => burnRate([])).toThrow(/no usage history/);
    expect(() => burnRate(null)).toThrow(/no usage history/);
  });

  it('names the day that is wrong', () => {
    expect(() => burnRate([10, -1])).toThrow(/day 2/);
  });
});

describe('daysOfCover', () => {
  it('divides the stock by the burn', () => {
    expect(daysOfCover(100, 20)).toBe(5);
  });

  it('has no answer when nothing is being used', () => {
    expect(daysOfCover(100, 0)).toBe(null);
  });

  it('is nothing when the shelf is empty', () => {
    expect(daysOfCover(0, 20)).toBe(0);
  });

  it('is nothing on a balance that came back negative', () => {
    expect(daysOfCover(-40, 20)).toBe(0);
  });
});

describe('reorderPoint', () => {
  it('covers the lead time and the safety days', () => {
    expect(reorderPoint({ dailyUse: 10, leadTimeDays: 3 })).toBe(50);
  });

  it('takes a different safety allowance', () => {
    expect(reorderPoint({ dailyUse: 10, leadTimeDays: 3, safetyDays: 0 })).toBe(30);
  });

  it('is nothing for a product that is not being used', () => {
    expect(reorderPoint({ dailyUse: 0, leadTimeDays: 3 })).toBe(0);
  });
});

describe('orderQuantity', () => {
  it('orders nothing while the shelf is above the point', () => {
    const order = orderQuantity({ stock: 300, dailyUse: 10, leadTimeDays: 3, coverDays: 14 });
    expect(order.order).toBe(0);
    expect(order.reason).toMatch(/above/);
  });

  it('orders up to the cover once the point is reached', () => {
    const order = orderQuantity({ stock: 40, dailyUse: 10, leadTimeDays: 3, coverDays: 14 });
    expect(order.order).toBe(100);
    expect(order.reason).toMatch(/at or below/);
  });

  it('rounds a part unit up', () => {
    const order = orderQuantity({ stock: 5, dailyUse: 3.4, leadTimeDays: 3, coverDays: 10 });
    expect(Number.isInteger(order.order)).toBe(true);
    expect(order.order).toBe(29);
  });

  it('orders against a balance that came back negative', () => {
    const order = orderQuantity({ stock: -40, dailyUse: 10, leadTimeDays: 3, coverDays: 14 });
    expect(order.order).toBe(140);
  });

  it('never orders a negative quantity', () => {
    const order = orderQuantity({ stock: 50, dailyUse: 10, leadTimeDays: 3, coverDays: 4 });
    expect(order.order).toBe(0);
  });
});

describe('reorderReport', () => {
  const rows = reorderReport({ stock, history, leadTimeDays: 3, coverDays: 14 });

  it('reports the tightest cover first', () => {
    expect(rows[0].code).toBe('PAC');
    expect(rows.at(-1).code).toBe('LCM');
  });

  it('puts a product with no burn at the end rather than at the front', () => {
    expect(rows.at(-1).daysOfCover).toBe(null);
    expect(rows.at(-1).short).toBe(false);
  });

  it('flags the products that are short', () => {
    const short = rows.filter((row) => row.short).map((row) => row.code);
    expect(short).toContain('PAC');
    expect(short).not.toContain('LCM');
  });

  it('carries the burn rate it worked from', () => {
    expect(rows.find((row) => row.code === 'CAU').dailyUse).toBe(8);
  });

  it('handles a product with no history at all', () => {
    const rows2 = reorderReport({ stock, history: {}, leadTimeDays: 3, coverDays: 14 });
    expect(rows2.every((row) => row.daysOfCover === null)).toBe(true);
  });
});
