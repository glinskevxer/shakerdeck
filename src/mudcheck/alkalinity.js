/**
 * Alkalinity, and what it says about the ions in the filtrate.
 *
 * Three titrations. Pf and Mf are run on the filtrate to phenolphthalein and
 * methyl orange, and Pm is run on whole mud. The pair of filtrate figures
 * splits the alkalinity between hydroxyl, carbonate and bicarbonate, and Pm
 * against Pf gives the lime that has not reacted yet.
 *
 * Carbonate contamination is the quiet one. The mud thickens at the low end,
 * the filtrate climbs, and nothing on the report says why until these three
 * numbers are read together.
 */
import { toNonNegative, round } from '../util/number.js';

/** Milligrams per litre of hydroxyl per millilitre of acid difference. */
export const HYDROXYL_FACTOR = 340;

/** Milligrams per litre of carbonate per millilitre of acid. */
export const CARBONATE_FACTOR = 1200;

/** Milligrams per litre of bicarbonate per millilitre of acid. */
export const BICARBONATE_FACTOR = 1220;

/**
 * Split the filtrate alkalinity between the three ions.
 */
export function ionSplit(pf, mf) {
  const p = toNonNegative(pf, 'pf');
  const m = toNonNegative(mf, 'mf');
  if (p > m) {
    throw new Error(`pf of ${p} is above mf of ${m}, one of the two titrations is wrong`);
  }
  if (p === 0) {
    return {
      hydroxylMgL: 0,
      carbonateMgL: 0,
      bicarbonateMgL: round(BICARBONATE_FACTOR * m, 1),
    };
  }
  if (2 * p < m) {
    return {
      hydroxylMgL: 0,
      carbonateMgL: round(CARBONATE_FACTOR * p, 1),
      bicarbonateMgL: round(BICARBONATE_FACTOR * (m - 2 * p), 1),
    };
  }
  if (2 * p === m) {
    return {
      hydroxylMgL: 0,
      carbonateMgL: round(CARBONATE_FACTOR * p, 1),
      bicarbonateMgL: 0,
    };
  }
  return {
    hydroxylMgL: round(HYDROXYL_FACTOR * (2 * p - m), 1),
    carbonateMgL: round(CARBONATE_FACTOR * (m - p), 1),
    bicarbonateMgL: 0,
  };
}

/**
 * Lime in the mud that has not reacted, in pounds per barrel.
 *
 * The water fraction comes off the retort. Using the whole mud figure without
 * it overstates the lime on any mud carrying real solids.
 */
export function excessLime(pm, pf, waterFraction = 1) {
  const m = toNonNegative(pm, 'pm');
  const f = toNonNegative(pf, 'pf');
  const water = toNonNegative(waterFraction, 'waterFraction');
  if (water > 1) {
    throw new Error(`the water fraction ${water} is above one, quote it as a fraction`);
  }
  return 0.26 * (m - water * f);
}

/**
 * True when the filtrate carries enough carbonate to be treated.
 *
 * The threshold is the one the field uses rather than a hard chemical limit:
 * below about five hundred milligrams per litre the low end climb is not worth
 * chasing, above about a thousand it is the reason the mud is thickening.
 */
export function carbonateProblem(pf, mf) {
  const split = ionSplit(pf, mf);
  if (split.carbonateMgL >= 1000) {
    return { level: 'treat', carbonateMgL: split.carbonateMgL };
  }
  if (split.carbonateMgL >= 500) {
    return { level: 'watch', carbonateMgL: split.carbonateMgL };
  }
  return { level: 'clear', carbonateMgL: split.carbonateMgL };
}

/**
 * Gypsum needed to drop a carbonate, in pounds per barrel.
 *
 * One mole of calcium takes out one mole of carbonate. The factor works the
 * milligrams per litre through to a sack count on the mixing hopper.
 */
export function gypsumForCarbonate(carbonateMgL, waterFraction = 1) {
  const carbonate = toNonNegative(carbonateMgL, 'carbonateMgL');
  const water = toNonNegative(waterFraction, 'waterFraction');
  return 0.000635 * carbonate * water * 42;
}

/**
 * The alkalinity block of the report.
 */
export function alkalinitySummary(alkalinity, waterFraction = 1) {
  if (!alkalinity || alkalinity.pf === null || alkalinity.mf === null) {
    return null;
  }
  const split = ionSplit(alkalinity.pf, alkalinity.mf);
  const problem = carbonateProblem(alkalinity.pf, alkalinity.mf);
  return {
    pf: alkalinity.pf,
    mf: alkalinity.mf,
    pm: alkalinity.pm ?? null,
    ...split,
    excessLimeLbBbl:
      alkalinity.pm === null || alkalinity.pm === undefined
        ? null
        : round(excessLime(alkalinity.pm, alkalinity.pf, waterFraction), 2),
    carbonateLevel: problem.level,
  };
}
