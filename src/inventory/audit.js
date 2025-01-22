/**
 * Counting what is actually on the pipe rack.
 *
 * The book says one thing and the count says another, and the difference is
 * either paperwork or product that has walked. Both matter and they are told
 * apart by whether the difference is a whole number of pallets.
 */
import { toNonNegative, round } from '../util/number.js';

/** How far out a count can be before it is worth chasing. */
export const TOLERANCE = { fraction: 0.02, units: 2 };

/**
 * Compare a count against the book.
 */
export function auditLine({ code, name, unit, book, counted, palletUnits = null }) {
  const onBook = toNonNegative(book, `${code} book`);
  const onRack = toNonNegative(counted, `${code} counted`);
  const difference = onRack - onBook;
  const allowed = Math.max(TOLERANCE.units, onBook * TOLERANCE.fraction);
  const wholePallets =
    palletUnits && palletUnits > 0 && Math.abs(difference) >= palletUnits
      ? Math.abs(difference) % palletUnits === 0
      : false;
  return {
    code,
    name,
    unit,
    book: round(onBook, 2),
    counted: round(onRack, 2),
    difference: round(difference, 2),
    differenceShare: onBook === 0 ? null : round(difference / onBook, 3),
    withinTolerance: Math.abs(difference) <= allowed,
    looksLikePaperwork: wholePallets,
  };
}

/**
 * Run a whole count.
 */
export function audit({ book, counted, pallets = {} }) {
  const rows = book.map((line) =>
    auditLine({
      code: line.code,
      name: line.name,
      unit: line.unit,
      book: line.closingQuantity,
      counted: counted[line.code] ?? 0,
      palletUnits: pallets[line.code] ?? null,
    })
  );
  const uncounted = Object.keys(counted).filter((code) => !book.some((line) => line.code === code));
  return {
    lines: rows.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)),
    outOfTolerance: rows.filter((row) => !row.withinTolerance).length,
    notOnTheBook: uncounted,
    clean: rows.every((row) => row.withinTolerance) && uncounted.length === 0,
  };
}

/**
 * What the variance is worth, which is the number that gets attention.
 */
export function auditValue({ lines, products }) {
  const prices = new Map(products.map((product) => [product.code, product]));
  let short = 0;
  let over = 0;
  const valued = lines.map((line) => {
    const product = prices.get(line.code);
    if (!product) {
      throw new Error(`${line.code} is not on the price list`);
    }
    const value = line.difference * product.pricePerUnit;
    if (value < 0) {
      short += value;
    } else {
      over += value;
    }
    return { ...line, value: round(value, 2) };
  });
  return {
    lines: valued,
    shortValue: round(short, 2),
    overValue: round(over, 2),
    netValue: round(short + over, 2),
  };
}

/**
 * Bring the book onto the count, which is what a count is for.
 */
export function adjustments(result) {
  return result.lines
    .filter((line) => line.difference !== 0)
    .map((line) => ({
      date: null,
      code: line.code,
      kind: line.difference < 0 ? 'lost' : 'received',
      quantity: Math.abs(line.difference),
      note: line.looksLikePaperwork ? 'whole pallets, look at the paperwork first' : 'stock count',
    }));
}
