/**
 * The recap command: the whole well on a few pages.
 */
import { buildRecap, renderRecap } from '../../report/recap.js';
import { readProgramme } from '../../program/window.js';
import { dayCost } from '../../cost/daily.js';
import { readProduct } from '../../inventory/stock.js';

/**
 * Value each day off the price list before the recap totals them.
 */
export function valueDays(days, products) {
  if (!products) {
    return [];
  }
  const priceList = products.map((row, index) => readProduct(row, `products[${index}]`));
  return days.map((day) =>
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
  );
}

export function recapCommand({ well, checks, programme = null, days = null, products = null }) {
  const data = buildRecap({
    well,
    checks,
    programme: programme ? readProgramme(programme) : null,
    days: days ? valueDays(days, products) : [],
  });
  return { data, lines: renderRecap(data) };
}
