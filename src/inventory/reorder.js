/**
 * When to order more.
 *
 * A rig two days from the nearest yard runs out of caustic on a Sunday if
 * nobody is watching the burn rate. The reorder point is the stock that covers
 * the lead time plus whatever safety the client wants, and it moves with what
 * is actually being used rather than sitting at a figure somebody set on spud
 * day.
 */
import { toNumber, toPositive, toNonNegative, round } from '../util/number.js';

/**
 * Average daily use over a run of days.
 */
export function burnRate(usageByDay) {
  if (!Array.isArray(usageByDay) || usageByDay.length === 0) {
    throw new Error('there is no usage history to work from');
  }
  const total = usageByDay.reduce(
    (sum, day, index) => sum + toNonNegative(day, `day ${index + 1}`),
    0
  );
  return total / usageByDay.length;
}

/**
 * Days of cover left at the current burn.
 */
export function daysOfCover(stock, dailyUse) {
  // A closing balance can come back negative when the opening stock was wrong,
  // and the ordering report is exactly where that has to be visible. Throwing
  // on it hid the one product the report existed to flag.
  const held = Math.max(0, toNumber(stock, 'stock'));
  const use = toNonNegative(dailyUse, 'dailyUse');
  if (use === 0) {
    return null;
  }
  return held / use;
}

/**
 * The stock at which an order has to go in.
 */
export function reorderPoint({ dailyUse, leadTimeDays, safetyDays = 2 }) {
  const use = toNonNegative(dailyUse, 'dailyUse');
  const lead = toNonNegative(leadTimeDays, 'leadTimeDays');
  const safety = toNonNegative(safetyDays, 'safetyDays');
  return use * (lead + safety);
}

/**
 * What to order, rounded up to whole units.
 */
export function orderQuantity({ stock, dailyUse, leadTimeDays, coverDays, safetyDays = 2 }) {
  const point = reorderPoint({ dailyUse, leadTimeDays, safetyDays });
  const held = Math.max(0, toNumber(stock, 'stock'));
  if (held > point) {
    return { order: 0, reorderPoint: round(point, 1), reason: 'above the reorder point' };
  }
  const target = toNonNegative(dailyUse, 'dailyUse') * toPositive(coverDays, 'coverDays');
  return {
    order: Math.ceil(Math.max(0, target - held)),
    reorderPoint: round(point, 1),
    reason: 'at or below the reorder point',
  };
}

/**
 * Run the whole shelf and report what needs ordering, worst first.
 */
export function reorderReport({ stock, history, leadTimeDays, coverDays, safetyDays = 2 }) {
  const rows = stock.map((line) => {
    const days = history?.[line.code] ?? [];
    const use = days.length === 0 ? 0 : burnRate(days);
    const cover = daysOfCover(line.closingQuantity, use);
    const order = orderQuantity({
      stock: line.closingQuantity,
      dailyUse: use,
      leadTimeDays,
      coverDays,
      safetyDays,
    });
    return {
      code: line.code,
      name: line.name,
      unit: line.unit,
      onHand: line.closingQuantity,
      dailyUse: round(use, 2),
      daysOfCover: cover === null ? null : round(cover, 1),
      reorderPoint: order.reorderPoint,
      order: order.order,
      short: order.order > 0,
    };
  });
  return rows.sort((a, b) => {
    if (a.daysOfCover === null) {
      return 1;
    }
    if (b.daysOfCover === null) {
      return -1;
    }
    return a.daysOfCover - b.daysOfCover;
  });
}
