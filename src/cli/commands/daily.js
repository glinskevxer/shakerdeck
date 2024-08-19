/**
 * The daily command: build the report page for one day on one well.
 */
import { buildDaily, renderDaily, dailyLine } from '../../report/daily.js';
import { readProgramme } from '../../program/window.js';
import { dayCost } from '../../cost/daily.js';
import { readProduct } from '../../inventory/stock.js';

/**
 * Put the day's records together into the shape the report wants.
 */
export function readDay({ day, check, programme = null, products = null }) {
  const priceList = products
    ? products.map((row, index) => readProduct(row, `products[${index}]`))
    : [];
  const costs =
    products && day.used
      ? dayCost({
          date: day.date,
          products: priceList,
          used: day.used,
          footageFeet: day.footageFeet ?? 0,
          mudBuiltBbl: day.mudBuiltBbl ?? 0,
          serviceCharge: day.serviceCharge ?? 0,
          rentalCharge: day.rentalCharge ?? 0,
          haulageCharge: day.haulageCharge ?? 0,
        })
      : null;
  return buildDaily({
    well: day.well,
    date: day.date,
    reportNumber: day.reportNumber,
    check,
    programme: programme ? readProgramme(programme) : null,
    activity: day.activity ?? [],
    products: costs ? costs.lines : [],
    costs,
    pits: day.pits ?? null,
    circulation: day.circulation ?? null,
  });
}

export function dailyCommand(inputs) {
  const data = readDay(inputs);
  return { data, lines: renderDaily(data), summary: dailyLine(data) };
}
