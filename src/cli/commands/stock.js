/**
 * The stock command: run the movements, report what is left and what needs
 * ordering.
 */
import { runStock, usage } from '../../inventory/stock.js';
import { reorderReport } from '../../inventory/reorder.js';
import { heading, rule } from '../../util/text.js';
import { definitionList, table } from '../../util/table.js';

/**
 * Turn the movements into a daily usage history, which is what the burn rate
 * is worked from.
 */
export function usageHistory(movements) {
  const days = new Map();
  for (const movement of movements) {
    if (movement.kind !== 'used') {
      continue;
    }
    const forCode = days.get(movement.code) ?? new Map();
    forCode.set(movement.date, (forCode.get(movement.date) ?? 0) + movement.quantity);
    days.set(movement.code, forCode);
  }
  const dates = [...new Set(movements.map((movement) => movement.date))].sort();
  const history = {};
  for (const [code, byDate] of days.entries()) {
    history[code] = dates.map((date) => byDate.get(date) ?? 0);
  }
  return history;
}

/**
 * Run the stock and work the ordering out.
 */
export function readStock({ products, opening, movements, leadTimeDays = 3, coverDays = 14 }) {
  const run = runStock({ products, opening: opening ?? {}, movements });
  const used = usage({ products, movements });
  const reorder = reorderReport({
    stock: run.closing,
    history: usageHistory(movements),
    leadTimeDays,
    coverDays,
  });
  return { run, used, reorder };
}

/**
 * Lay the stock report out.
 */
export function renderStock(data) {
  const lines = [
    heading('product stock'),
    rule(70),
    table(
      [
        { key: 'code', heading: 'code' },
        { key: 'name', heading: 'product' },
        { key: 'openingQuantity', heading: 'opening', decimals: 0, align: 'right' },
        { key: 'closingQuantity', heading: 'closing', decimals: 0, align: 'right' },
        { key: 'unit', heading: 'unit' },
      ],
      data.run.closing
    ),
    '',
    heading('used'),
    table(
      [
        { key: 'name', heading: 'product' },
        { key: 'quantity', heading: 'qty', decimals: 0, align: 'right' },
        { key: 'unit', heading: 'unit' },
        { key: 'value', heading: 'value', decimals: 2, align: 'right' },
      ],
      data.used
    ),
    '',
    heading('ordering'),
    table(
      [
        { key: 'name', heading: 'product' },
        { key: 'onHand', heading: 'on hand', decimals: 0, align: 'right' },
        { key: 'dailyUse', heading: 'per day', decimals: 2, align: 'right' },
        { key: 'daysOfCover', heading: 'cover', decimals: 1, align: 'right', blank: 'none used' },
        { key: 'order', heading: 'order', decimals: 0, align: 'right' },
      ],
      data.reorder
    ),
  ];
  if (!data.run.reconciles) {
    lines.push('', heading('the stock does not reconcile'));
    for (const error of data.run.errors) {
      lines.push(`  ${error}`);
    }
  } else {
    lines.push('', ...definitionList([['reconciles', 'yes']]));
  }
  return lines;
}

export function stockCommand(inputs) {
  const data = readStock(inputs);
  return { data, lines: renderStock(data) };
}
