/**
 * Methylene blue, sand and filter cake.
 *
 * The methylene blue test is the only reading on the sheet that says what the
 * solids are rather than how much of them there is. Clay takes the dye and
 * sand does not, so a mud whose solids are climbing while its blue capacity
 * stays flat is picking up ground shale, not gaining clay.
 */
import { toNonNegative, toPositive, round } from '../util/number.js';
import { POUNDS_PER_BARREL_WATER, LOW_GRAVITY_SG } from '../solids/analysis.js';

/** Pounds per barrel of bentonite for each millilitre of dye per millilitre of mud. */
export const METHYLENE_BLUE_FACTOR = 5;

/** Milliequivalents per hundred grams of pure bentonite. */
export const BENTONITE_CEC = 70;

/**
 * Bentonite equivalent in pounds per barrel.
 */
export function methyleneBlue(dyeMillilitres, sampleMillilitres = 1) {
  const dye = toNonNegative(dyeMillilitres, 'dyeMillilitres');
  const sample = toPositive(sampleMillilitres, 'sampleMillilitres');
  return (METHYLENE_BLUE_FACTOR * dye) / sample;
}

/**
 * Cation exchange capacity of the solids, in milliequivalents per hundred
 * grams. This is the figure a shale that swells is judged on.
 */
export function cationExchangeCapacity(bentoniteLbBbl, solidsLbBbl) {
  const bentonite = toNonNegative(bentoniteLbBbl, 'bentoniteLbBbl');
  const solids = toPositive(solidsLbBbl, 'solidsLbBbl');
  return (bentonite * BENTONITE_CEC) / solids;
}

/**
 * How much of the low gravity fraction is clay rather than ground rock.
 */
export function clayFraction(bentoniteLbBbl, lowGravityLbBbl) {
  const bentonite = toNonNegative(bentoniteLbBbl, 'bentoniteLbBbl');
  const low = toPositive(lowGravityLbBbl, 'lowGravityLbBbl');
  return Math.min(1, bentonite / low);
}

/**
 * Volume percent of bentonite from its weight per barrel.
 */
export function bentonitePercent(bentoniteLbBbl) {
  return (
    (toNonNegative(bentoniteLbBbl, 'bentoniteLbBbl') * 100) /
    (POUNDS_PER_BARREL_WATER * LOW_GRAVITY_SG)
  );
}

/**
 * What the sand reading means for the pumps.
 *
 * Sand is abrasive and it settles. A quarter of a percent is normal, half a
 * percent is a shaker screen that has torn, and anything above one is doing
 * damage to the liners while the report is being written.
 */
export function sandVerdict(sandPercent) {
  const sand = toNonNegative(sandPercent, 'sandPercent');
  if (sand <= 0.25) {
    return { level: 'normal', sandPercent: sand };
  }
  if (sand <= 0.5) {
    return { level: 'high', sandPercent: sand };
  }
  if (sand <= 1) {
    return { level: 'check the screens', sandPercent: sand };
  }
  return { level: 'damaging the pumps', sandPercent: sand };
}

/**
 * Filter cake thickness reads in thirty seconds of an inch on the sheet
 * because that is what the ruler on the press is marked in.
 */
export function cakeThickness(thirtySecondInch) {
  const reading = toNonNegative(thirtySecondInch, 'thirtySecondInch');
  return {
    thirtySecondInch: reading,
    inches: round(reading / 32, 4),
    millimetres: round((reading / 32) * 25.4, 2),
  };
}

/**
 * Filtrate at any time other than thirty minutes scales with the square root
 * of time, so a seven and a half minute reading doubles to the api figure.
 */
export function filtrateAtThirtyMinutes(millilitres, minutes) {
  const volume = toNonNegative(millilitres, 'millilitres');
  const time = toPositive(minutes, 'minutes');
  return volume * Math.sqrt(30 / time);
}

/**
 * The clay block of the report.
 */
export function claySummary({ mbtLbBbl, sandPercent, lowGravityLbBbl, solidsLbBbl }) {
  if (mbtLbBbl === null || mbtLbBbl === undefined) {
    return null;
  }
  return {
    bentoniteLbBbl: round(mbtLbBbl, 1),
    bentonitePercent: round(bentonitePercent(mbtLbBbl), 2),
    cationExchangeCapacity: solidsLbBbl
      ? round(cationExchangeCapacity(mbtLbBbl, solidsLbBbl), 1)
      : null,
    clayFraction: lowGravityLbBbl ? round(clayFraction(mbtLbBbl, lowGravityLbBbl), 3) : null,
    sand: sandPercent === null || sandPercent === undefined ? null : sandVerdict(sandPercent).level,
  };
}
