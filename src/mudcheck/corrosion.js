/**
 * Corrosion, measured rather than argued about.
 *
 * A ring coupon goes in a tool joint at the start of a bit run and comes out
 * at the end. What it lost in weight over the days it was down, spread over
 * its area, is the corrosion rate, and it is the only number in the whole
 * subject that is not somebody's opinion.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/** Density of the coupon steel, pounds per cubic inch. */
export const STEEL_DENSITY = 0.2836;

/** The bands the industry judges a rate against, in pounds per square foot per year. */
export const CORROSION_BANDS = [
  { upTo: 1, name: 'very low' },
  { upTo: 2.9, name: 'low' },
  { upTo: 4.9, name: 'moderate' },
  { upTo: 7.9, name: 'high' },
  { upTo: Infinity, name: 'severe' },
];

/**
 * Corrosion rate in pounds per square foot per year.
 */
export function corrosionRate({ lostGrams, areaSquareInches, daysExposed }) {
  const lost = toNonNegative(lostGrams, 'lostGrams');
  const area = toPositive(areaSquareInches, 'areaSquareInches');
  const days = toPositive(daysExposed, 'daysExposed');
  const pounds = lost / 453.592;
  const squareFeet = area / 144;
  return (pounds / squareFeet) * (365 / days);
}

/**
 * The same rate as a thickness loss, which is what a pipe inspector wants.
 */
export function pittingRate({ ratePoundsPerSquareFootPerYear }) {
  const rate = toNonNegative(ratePoundsPerSquareFootPerYear, 'ratePoundsPerSquareFootPerYear');
  // A pound over a square foot of steel is this deep, in thousandths of an inch.
  const inchesPerPoundPerSquareFoot = 1 / (STEEL_DENSITY * 144);
  return round(rate * inchesPerPoundPerSquareFoot * 1000, 2);
}

/**
 * What the rate is called.
 */
export function corrosionBand(rate) {
  const value = toNonNegative(rate, 'rate');
  return CORROSION_BANDS.find((band) => value <= band.upTo).name;
}

/**
 * A coupon read end to end.
 */
export function readCoupon({
  serial,
  startGrams,
  endGrams,
  areaSquareInches,
  daysExposed,
  location = 'kelly',
  pitting = false,
}) {
  const start = toPositive(startGrams, 'startGrams');
  const end = toPositive(endGrams, 'endGrams');
  if (end > start) {
    throw new Error(`coupon ${serial} came out heavier than it went in`);
  }
  const rate = corrosionRate({ lostGrams: start - end, areaSquareInches, daysExposed });
  return {
    serial,
    location,
    daysExposed,
    lostGrams: round(start - end, 4),
    rate: round(rate, 2),
    band: corrosionBand(rate),
    thousandthsPerYear: pittingRate({ ratePoundsPerSquareFootPerYear: rate }),
    pitting,
    // Pitting is worse than a uniform loss at the same rate, because it goes
    // through the wall in one place instead of thinning it everywhere.
    acceptable: rate <= 2.9 && !pitting,
  };
}

/**
 * A run of coupons, worst first, with what they say about the system.
 */
export function couponRun(coupons) {
  if (!Array.isArray(coupons) || coupons.length === 0) {
    throw new Error('there are no coupons to read');
  }
  const rows = coupons.map((coupon) => readCoupon(coupon)).sort((a, b) => b.rate - a.rate);
  const pitted = rows.filter((row) => row.pitting);
  return {
    coupons: rows,
    worst: rows[0],
    anyPitting: pitted.length > 0,
    allAcceptable: rows.every((row) => row.acceptable),
    treat: rows.some((row) => !row.acceptable),
  };
}

/**
 * Oxygen is the usual cause, and a scavenger dose is worked off the water in
 * the mud rather than off the whole system.
 */
export function scavengerDose({ oxygenPartsPerMillion, waterBbl, scavengerPerPpm = 0.15 }) {
  const oxygen = toNonNegative(oxygenPartsPerMillion, 'oxygenPartsPerMillion');
  const water = toPositive(waterBbl, 'waterBbl');
  const rate = toPositive(scavengerPerPpm, 'scavengerPerPpm');
  return {
    poundsPerBarrel: round(oxygen * rate, 3),
    totalPounds: round(oxygen * rate * water, 1),
  };
}
