/**
 * The mud balance, and whether it is telling the truth.
 *
 * Every other number on the sheet is worked from the weight, so a balance that
 * is out puts the solids analysis, the hydrostatic and the circulating density
 * out with it. It is calibrated against fresh water, it goes out of
 * calibration when the knife edge wears or the cup lid seats badly, and
 * nobody checks it unless there is a reason to.
 */
import { toPositive, toNumber, round } from '../util/number.js';
import { WATER_PPG } from '../units/density.js';

/** How far a balance can read off water and still be trusted. */
export const CALIBRATION_TOLERANCE = 0.1;

/**
 * Check a balance against fresh water.
 */
export function calibrate({ readingPpg, waterPpg = WATER_PPG }) {
  const reading = toPositive(readingPpg, 'readingPpg');
  const truth = toPositive(waterPpg, 'waterPpg');
  const error = reading - truth;
  return {
    readingPpg: round(reading, 2),
    trueWeight: round(truth, 3),
    errorPpg: round(error, 3),
    withinTolerance: Math.abs(error) <= CALIBRATION_TOLERANCE,
    correction: round(-error, 3),
  };
}

/**
 * Apply a calibration correction to a reading.
 */
export function corrected({ readingPpg, correction }) {
  return round(toPositive(readingPpg, 'readingPpg') + toNumber(correction, 'correction'), 2);
}

/**
 * What a balance error is worth at the bottom of the hole.
 *
 * A tenth of a pound is nothing on the sheet and it is fifty psi at ten
 * thousand feet, which is the whole of a tight overbalance.
 */
export function errorAtDepth({ errorPpg, tvdFeet }) {
  const error = toNumber(errorPpg, 'errorPpg');
  const depth = toPositive(tvdFeet, 'tvdFeet');
  return {
    psi: round(0.052 * error * depth, 0),
    equivalentPpg: round(error, 3),
  };
}

/**
 * Two balances against each other, which is what happens when a check is
 * disputed. Neither of them is right, but the difference says which one to
 * take to the water bucket.
 */
export function compareBalances({ readings, waterPpg = WATER_PPG }) {
  if (!Array.isArray(readings) || readings.length < 2) {
    throw new Error('a comparison needs at least two balances');
  }
  const rows = readings.map((reading, index) => ({
    label: reading.label ?? `balance ${index + 1}`,
    ...calibrate({ readingPpg: reading.waterReadingPpg, waterPpg }),
    mudReadingPpg: reading.mudReadingPpg ?? null,
  }));
  const worst = rows.reduce((found, row) =>
    Math.abs(row.errorPpg) > Math.abs(found.errorPpg) ? row : found
  );
  const spread =
    Math.max(...rows.map((row) => row.readingPpg)) - Math.min(...rows.map((row) => row.readingPpg));
  return {
    balances: rows,
    worst: worst.label,
    spreadPpg: round(spread, 3),
    allWithinTolerance: rows.every((row) => row.withinTolerance),
  };
}

/**
 * Whether a weight reading agrees with the retort that was run on the same
 * sample. They come from the same mud, so a disagreement is one of the two
 * being wrong rather than a property of the mud.
 */
export function agreesWithRetort({
  weightPpg,
  solidsPercent,
  waterPercent,
  oilPercent = 0,
  averageSolidsSg = 3.7,
}) {
  const solids = toPositive(solidsPercent, 'solidsPercent');
  const water = toPositive(waterPercent, 'waterPercent');
  const oil = toNumber(oilPercent, 'oilPercent');
  const implied =
    ((solids * toPositive(averageSolidsSg, 'averageSolidsSg') + water * 1 + oil * 0.84) / 100) *
    WATER_PPG;
  const reading = toPositive(weightPpg, 'weightPpg');
  const difference = reading - implied;
  return {
    readingPpg: round(reading, 2),
    impliedPpg: round(implied, 2),
    differencePpg: round(difference, 2),
    agrees: Math.abs(difference) <= 0.3,
  };
}
