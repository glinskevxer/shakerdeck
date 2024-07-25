/**
 * What the mud costs.
 *
 * Two numbers get argued about on every well. The cost per foot is what the
 * drilling engineer compares between wells, and it is only fair where the hole
 * sizes match. The cost per barrel of mud built is what says whether this
 * particular system is being run well, and it is the one the mud engineer can
 * actually move.
 */
import { toPositive, toNonNegative, round, divide } from '../util/number.js';

/**
 * Value a day's product use off the price list.
 */
export function dayProductCost({ products, used }) {
  const prices = new Map(products.map((product) => [product.code, product]));
  const lines = [];
  let total = 0;
  for (const [code, quantity] of Object.entries(used)) {
    const product = prices.get(code);
    if (!product) {
      throw new Error(`${code} is not on the price list`);
    }
    const value = toNonNegative(quantity, code) * product.pricePerUnit;
    total += value;
    lines.push({
      code,
      name: product.name,
      quantity: round(quantity, 2),
      unit: product.unit,
      value: round(value, 2),
      category: product.category ?? 'general',
    });
  }
  return {
    lines: lines.sort((a, b) => b.value - a.value),
    total: round(total, 2),
  };
}

/**
 * A day on the well, with everything that goes on the invoice.
 */
export function dayCost({
  date,
  products,
  used,
  footageFeet = 0,
  mudBuiltBbl = 0,
  serviceCharge = 0,
  rentalCharge = 0,
  haulageCharge = 0,
}) {
  const productCost = dayProductCost({ products, used });
  const service = toNonNegative(serviceCharge, 'serviceCharge');
  const rental = toNonNegative(rentalCharge, 'rentalCharge');
  const haulage = toNonNegative(haulageCharge, 'haulageCharge');
  const total = productCost.total + service + rental + haulage;
  const footage = toNonNegative(footageFeet, 'footageFeet');
  const built = toNonNegative(mudBuiltBbl, 'mudBuiltBbl');
  return {
    date,
    lines: productCost.lines,
    productCost: productCost.total,
    serviceCharge: round(service, 2),
    rentalCharge: round(rental, 2),
    haulageCharge: round(haulage, 2),
    total: round(total, 2),
    footageFeet: footage,
    mudBuiltBbl: built,
    costPerFoot: footage === 0 ? null : round(total / footage, 2),
    costPerBarrelBuilt: built === 0 ? null : round(total / built, 2),
  };
}

/**
 * A run of days, with the totals carried through.
 */
export function costToDate(days) {
  if (!Array.isArray(days) || days.length === 0) {
    throw new Error('there are no days to total');
  }
  let cost = 0;
  let footage = 0;
  let built = 0;
  const rows = days.map((day) => {
    cost += day.total;
    footage += day.footageFeet;
    built += day.mudBuiltBbl;
    return {
      date: day.date,
      total: day.total,
      cumulativeCost: round(cost, 2),
      footageFeet: day.footageFeet,
      cumulativeFootage: footage,
      costPerFootToDate: footage === 0 ? null : round(cost / footage, 2),
    };
  });
  return {
    days: rows,
    totalCost: round(cost, 2),
    totalFootage: footage,
    totalBuiltBbl: round(built, 2),
    costPerFoot: footage === 0 ? null : round(cost / footage, 2),
    costPerBarrelBuilt: built === 0 ? null : round(cost / built, 2),
  };
}

/**
 * Where the money went, by category.
 */
export function costByCategory(days) {
  const totals = new Map();
  for (const day of days) {
    for (const line of day.lines) {
      totals.set(line.category, (totals.get(line.category) ?? 0) + line.value);
    }
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return [];
  }
  return [...totals.entries()]
    .map(([category, value]) => ({
      category,
      value: round(value, 2),
      share: round(value / total, 3),
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Cost per foot for one hole section, which is the only fair comparison
 * between wells.
 */
export function sectionCostPerFoot({ costs, fromFeet, toFeet }) {
  const from = toNonNegative(fromFeet, 'fromFeet');
  const to = toPositive(toFeet, 'toFeet');
  if (to <= from) {
    throw new Error(`${to} is not below ${from} in the hole`);
  }
  const total = costs.reduce((sum, cost) => sum + toNonNegative(cost, 'cost'), 0);
  return round(divide(total, to - from, 'section length'), 2);
}
