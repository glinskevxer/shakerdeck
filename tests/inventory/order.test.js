import { describe, it, expect } from 'vitest';
import {
  readOrderLine,
  readOrder,
  outstanding,
  receive,
  lateOrders,
  onOrder,
  coverWithOrders,
} from '../../src/inventory/order.js';

const raw = {
  number: 'PO-8841',
  placed: '2025-07-14',
  expected: '2025-07-20',
  supplier: 'the yard',
  lines: [
    { code: 'BAR', ordered: 400, delivered: 400, unitPrice: 16 },
    { code: 'PAC', ordered: 60, delivered: 24, unitPrice: 96 },
    { code: 'CAU', ordered: 40, unitPrice: 42 },
  ],
};

const order = readOrder(raw);

describe('readOrderLine', () => {
  it('reads a line', () => {
    expect(readOrderLine(raw.lines[1]).delivered).toBe(24);
  });

  it('takes a line with nothing delivered yet', () => {
    expect(readOrderLine(raw.lines[2]).delivered).toBe(0);
  });

  it('refuses a line for nothing', () => {
    expect(() => readOrderLine({ code: 'BAR', ordered: 0, unitPrice: 16 })).toThrow(
      /must be above 0/
    );
  });

  it('names the field that is wrong', () => {
    expect(() => readOrderLine({ ordered: 40, unitPrice: 16 }, 'lines[2]')).toThrow(
      /lines\[2\].code/
    );
  });
});

describe('readOrder', () => {
  it('reads every line', () => {
    expect(order.lines).toHaveLength(3);
    expect(order.supplier).toBe('the yard');
  });

  it('takes an order with no expected date', () => {
    expect(readOrder({ ...raw, expected: undefined }).expected).toBe(null);
  });

  it('refuses an order with no lines', () => {
    expect(() => readOrder({ ...raw, lines: [] })).toThrow(/no lines on it/);
  });
});

describe('outstanding', () => {
  const open = outstanding(order);

  it('leaves out the lines that came in full', () => {
    expect(open.lines.map((line) => line.code)).toEqual(['PAC', 'CAU']);
  });

  it('values what is still to come', () => {
    expect(open.outstandingValue).toBe(36 * 96 + 40 * 42);
  });

  it('is not complete while anything is outstanding', () => {
    expect(open.complete).toBe(false);
  });

  it('is complete when everything has come', () => {
    const done = outstanding(
      readOrder({ ...raw, lines: raw.lines.map((line) => ({ ...line, delivered: line.ordered })) })
    );
    expect(done.complete).toBe(true);
    expect(done.outstandingValue).toBe(0);
  });

  it('reports an over delivery rather than hiding it', () => {
    const over = outstanding(
      readOrder({ ...raw, lines: [{ code: 'BAR', ordered: 400, delivered: 440, unitPrice: 16 }] })
    );
    expect(over.lines[0].overDelivered).toBe(40);
  });
});

describe('receive', () => {
  it('books a delivery', () => {
    const after = receive({ order, code: 'CAU', quantity: 40 });
    expect(after.lines.find((line) => line.code === 'CAU').delivered).toBe(40);
    expect(outstanding(after).complete).toBe(false);
  });

  it('leaves the order it was booked against alone', () => {
    receive({ order, code: 'CAU', quantity: 40 });
    expect(order.lines.find((line) => line.code === 'CAU').delivered).toBe(0);
  });

  it('refuses a delivery of something that was not ordered', () => {
    expect(() => receive({ order, code: 'XCD', quantity: 4 })).toThrow(
      /XCD is not on order PO-8841/
    );
  });

  it('refuses a delivery of nothing', () => {
    expect(() => receive({ order, code: 'CAU', quantity: 0 })).toThrow(/above zero/);
  });
});

describe('lateOrders', () => {
  it('finds an order past its date with something outstanding', () => {
    expect(lateOrders({ orders: [order], today: '2025-07-25' })).toHaveLength(1);
  });

  it('finds nothing before the date', () => {
    expect(lateOrders({ orders: [order], today: '2025-07-18' })).toEqual([]);
  });

  it('finds nothing once the order is complete', () => {
    const done = readOrder({
      ...raw,
      lines: raw.lines.map((line) => ({ ...line, delivered: line.ordered })),
    });
    expect(lateOrders({ orders: [done], today: '2025-07-25' })).toEqual([]);
  });

  it('ignores an order with no date on it', () => {
    const undated = readOrder({ ...raw, expected: undefined });
    expect(lateOrders({ orders: [undated], today: '2025-07-25' })).toEqual([]);
  });
});

describe('onOrder and coverWithOrders', () => {
  it('adds up what is still to come for a product', () => {
    expect(onOrder({ orders: [order], code: 'PAC' })).toBe(36);
    expect(onOrder({ orders: [order], code: 'XCD' })).toBe(0);
  });

  it('counts what is on the way into the cover', () => {
    const cover = coverWithOrders({ onHand: 8, orders: [order], code: 'PAC', dailyUse: 4 });
    expect(cover.daysWithoutTheOrder).toBe(2);
    expect(cover.daysOfCover).toBe(11);
  });

  it('has no answer when nothing is being used', () => {
    expect(
      coverWithOrders({ onHand: 8, orders: [order], code: 'PAC', dailyUse: 0 }).daysOfCover
    ).toBe(null);
  });
});
