/**
 * Solids analysis off the retort and the mud balance.
 *
 * The retort gives the volume the solids take up. It does not say what they
 * are, and the difference between a barrel of barite and a barrel of drilled
 * shale is the whole of the mud engineer's job. The split comes out of a
 * weight balance: the mud weighs what it weighs, the liquids are known, so
 * whatever is left has an average density, and that density places the solids
 * between barite and clay.
 */
import { toNumber, toNonNegative, toPositive, round } from '../util/number.js';
import { WATER_PPG } from '../units/density.js';

/** Specific gravity of barite as it is sold. */
export const BARITE_SG = 4.2;

/** Specific gravity taken for drilled solids and commercial clay alike. */
export const LOW_GRAVITY_SG = 2.6;

/** Specific gravity of a typical base oil. */
export const BASE_OIL_SG = 0.84;

/** Pounds in a barrel of fresh water, the constant behind every lb per bbl. */
export const POUNDS_PER_BARREL_WATER = 350;

/**
 * Weight of a solid in pounds per barrel of mud, from its specific gravity and
 * the volume percent it occupies.
 */
export function solidWeight(specificGravity, volumePercent) {
  return (
    (POUNDS_PER_BARREL_WATER *
      toPositive(specificGravity, 'specificGravity') *
      toNonNegative(volumePercent, 'volumePercent')) /
    100
  );
}

/**
 * Average specific gravity of everything the retort left behind.
 *
 * A figure near 2.6 is a mud carrying nothing but drilled solids and clay. A
 * figure near 4.2 is a mud that is almost all barite. Anything outside 2.4 to
 * 4.3 means the retort, the balance or the salinity correction is wrong.
 */
export function averageSolidsSg({
  weightPpg,
  solidsPercent,
  waterPercent,
  oilPercent = 0,
  brineSg = 1,
  oilSg = BASE_OIL_SG,
}) {
  const mudSg = toPositive(weightPpg, 'weightPpg') / WATER_PPG;
  const solids = toPositive(solidsPercent, 'solidsPercent');
  const water = toNonNegative(waterPercent, 'waterPercent');
  const oil = toNonNegative(oilPercent, 'oilPercent');
  const total = solids + water + oil;
  if (Math.abs(total - 100) > 1) {
    throw new Error(`the retort adds up to ${round(total, 1)} percent, not a full cup`);
  }
  return (
    (100 * mudSg - toPositive(brineSg, 'brineSg') * water - toPositive(oilSg, 'oilSg') * oil) /
    solids
  );
}

/**
 * Split the solids between the heavy ones that were bought and the light ones
 * that came out of the hole.
 */
export function soliditySplit(analysis) {
  const average = averageSolidsSg(analysis);
  const solids = toPositive(analysis.solidsPercent, 'solidsPercent');
  const highGravity = (solids * (average - LOW_GRAVITY_SG)) / (BARITE_SG - LOW_GRAVITY_SG);
  const lowGravity = solids - highGravity;
  return {
    averageSg: round(average, 3),
    highGravityPercent: round(highGravity, 2),
    lowGravityPercent: round(lowGravity, 2),
    bariteLbBbl: round(solidWeight(BARITE_SG, Math.max(0, highGravity)), 1),
    lowGravityLbBbl: round(solidWeight(LOW_GRAVITY_SG, Math.max(0, lowGravity)), 1),
    negativeHighGravity: highGravity < 0,
    negativeLowGravity: lowGravity < 0,
  };
}

/**
 * Drilled solids, which is the low gravity fraction less the clay that was
 * mixed in on purpose. The bentonite figure comes off the methylene blue test.
 */
export function drilledSolids(lowGravityPercent, bentoniteLbBbl = 0) {
  // A low gravity fraction can come out below zero when the average solids
  // gravity lands above barite, which means the retort, the balance or the
  // salinity correction is wrong. That is worth reporting rather than
  // throwing, because the report is what shows the mud engineer the mistake.
  const low = toNumber(lowGravityPercent, 'lowGravityPercent');
  const bentonite = toNonNegative(bentoniteLbBbl, 'bentoniteLbBbl');
  const bentonitePercent = (bentonite * 100) / (POUNDS_PER_BARREL_WATER * LOW_GRAVITY_SG);
  const drilled = low - bentonitePercent;
  return {
    bentonitePercent: round(bentonitePercent, 2),
    drilledPercent: round(drilled, 2),
    drilledLbBbl: round(solidWeight(LOW_GRAVITY_SG, Math.max(0, drilled)), 1),
  };
}

/**
 * The ratio the whole solids control spread is judged on. Drilled solids
 * against the clay that is meant to be there: above about three to one on a
 * weighted mud the shakers are losing.
 */
export function drilledToBentoniteRatio(drilledPercent, bentonitePercent) {
  const bentonite = toNonNegative(bentonitePercent, 'bentonitePercent');
  if (bentonite === 0) {
    return null;
  }
  return Math.max(0, toNumber(drilledPercent, 'drilledPercent')) / bentonite;
}

/**
 * The solids block of the report.
 */
export function solidsSummary(analysis) {
  const split = soliditySplit(analysis);
  const drilled = drilledSolids(split.lowGravityPercent, analysis.bentoniteLbBbl ?? 0);
  return {
    solidsPercent: round(toPositive(analysis.solidsPercent, 'solidsPercent'), 2),
    ...split,
    ...drilled,
    drilledToBentonite:
      drilled.bentonitePercent === 0
        ? null
        : round(
            drilledToBentoniteRatio(Math.max(0, drilled.drilledPercent), drilled.bentonitePercent),
            2
          ),
  };
}
