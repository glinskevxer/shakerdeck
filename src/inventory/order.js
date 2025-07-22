/**
 * Purchase orders.
 *
 * What was ordered, what has been delivered against it, and what is still
 * outstanding. It is the third book after the stock and the transfers, and it
 * is the one that gets kept in somebody's notebook.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { requireObject, requireString, requireNumber, optionalString } from '../valid/schema.js';

/**
 * Read one order line.
 */
export function readOrderLine(record, path = 'line') {
  requireObject(record, path);
  return {
    code: requireString(record, 'code', path),
    ordered: requireNumber(record, 'ordered', path, { above: 0 }),
    delivered:
      record.delivered === undefined ? 0 : requireNumber(record, 'delivered', path, { minimum: 0 }),
    unitPrice: requireNumber(record, 'unitPrice', path, { minimum: 0 }),
  };
}

/**
 * Read a whole order.
 */
export function readOrder(record, path = 'order') {
  requireObject(record, path);
  const lines = (record.lines ?? []).map((line, index) =>
    readOrderLine(line, `${path}.lines[${index}]`)
  );
  if (lines.length === 0) {
    throw new Error('an order with no lines on it is not an order');
  }
  return {
    number: requireString(record, 'number', path),
    placed: requireString(record, 'placed', path),
    supplier: requireString(record, 'supplier', path),
    expected: optionalString(record, 'expected', null, path),
    lines,
  };
}

/**
 * What is still outstanding on an order.
 */
export function outstanding(order) {
  const lines = order.lines
    .map((line) => ({
      ...line,
      outstanding: round(Math.max(0, line.ordered - line.delivered), 2),
      overDelivered: round(Math.max(0, line.delivered - line.ordered), 2),
      value: round(Math.max(0, line.ordered - line.delivered) * line.unitPrice, 2),
    }))
    .filter((line) => line.outstanding > 0 || line.overDelivered > 0);
  return {
    number: order.number,
    supplier: order.supplier,
    lines,
    outstandingValue: round(
      lines.reduce((total, line) => total + line.value, 0),
      2
    ),
    complete: lines.every((line) => line.outstanding === 0),
  };
}

/**
 * Book a delivery against an order, without changing the order it was booked
 * against.
 */
export function receive({ order, code, quantity }) {
  const amount = toPositive(quantity, 'quantity');
  const line = order.lines.find((row) => row.code === code);
  if (!line) {
    throw new Error(`${code} is not on order ${order.number}`);
  }
  return {
    ...order,
    lines: order.lines.map((row) =>
      row.code === code ? { ...row, delivered: round(row.delivered + amount, 2) } : row
    ),
  };
}

/**
 * Orders that are late, worst first.
 */
export function lateOrders({ orders, today }) {
  return orders
    .map((order) => outstanding(order))
    .map((summary, index) => ({ ...summary, expected: orders[index].expected }))
    .filter((summary) => !summary.complete && summary.expected !== null && summary.expected < today)
    .sort((a, b) => (a.expected < b.expected ? -1 : 1));
}

/**
 * What is on order for a product, across every open order.
 */
export function onOrder({ orders, code }) {
  return round(
    orders.reduce((total, order) => {
      const line = order.lines.find((row) => row.code === code);
      if (!line) {
        return total;
      }
      return total + Math.max(0, line.ordered - line.delivered);
    }, 0),
    2
  );
}

/**
 * Days of cover including what is on the way, which is the number that decides
 * whether to order again.
 */
export function coverWithOrders({ onHand, orders, code, dailyUse }) {
  const held = toNonNegative(onHand, 'onHand');
  const coming = onOrder({ orders, code });
  const use = toNonNegative(dailyUse, 'dailyUse');
  return {
    onHand: round(held, 2),
    onOrder: coming,
    total: round(held + coming, 2),
    daysOfCover: use === 0 ? null : round((held + coming) / use, 1),
    daysWithoutTheOrder: use === 0 ? null : round(held / use, 1),
  };
}
