/**
 * The export command: write one of the tables out as a comma separated file.
 */
import { EXPORTS, exportChecks, exportDays, exportStock } from '../../report/export.js';
import { readChecks } from '../../mudcheck/record.js';
import { runStock } from '../../inventory/stock.js';
import { readProduct } from '../../inventory/stock.js';
import { dayCost } from '../../cost/daily.js';

/**
 * Build the table that was asked for.
 */
export function buildExport({ table, input, products = null, opening = {} }) {
  if (!EXPORTS[table]) {
    throw new Error(
      `there is nothing called ${table} to export, try ${Object.keys(EXPORTS).join(', ')}`
    );
  }
  if (table === 'checks') {
    return exportChecks(readChecks(input));
  }
  if (table === 'days') {
    if (!products) {
      throw new Error('the day export needs a price list to value the products against');
    }
    const priceList = products.map((row, index) => readProduct(row, `products[${index}]`));
    return exportDays(
      input.map((day) =>
        dayCost({
          date: day.date,
          products: priceList,
          used: day.used ?? {},
          footageFeet: day.footageFeet ?? 0,
          mudBuiltBbl: day.mudBuiltBbl ?? 0,
          serviceCharge: day.serviceCharge ?? 0,
          rentalCharge: day.rentalCharge ?? 0,
          haulageCharge: day.haulageCharge ?? 0,
        })
      )
    );
  }
  if (table === 'stock') {
    if (!products) {
      throw new Error('the stock export needs a price list');
    }
    return exportStock(runStock({ products, opening, movements: input }).closing);
  }
  throw new Error(`${table} has to be exported from a hydraulics run, not from a file`);
}

export function exportCommand(options) {
  const text = buildExport(options);
  return { data: text, lines: text.trimEnd().split('\n') };
}
