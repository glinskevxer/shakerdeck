/**
 * The wet chemistry on the filtrate: chloride, hardness and what they mean
 * for the water phase.
 *
 * Every one of these is a burette reading turned into milligrams per litre by
 * a factor that depends on the strength of the solution in the bottle. The
 * strength is an argument rather than a constant because a rig lab carries
 * both the weak and the strong silver nitrate and grabbing the wrong one is a
 * mistake that shows up as a chloride an order of magnitude out.
 */
import { toNonNegative, toPositive, round, divide } from '../util/number.js';

/** Milligrams of chloride in one equivalent, times a thousand for the litre. */
export const CHLORIDE_EQUIVALENT = 35450;

/** Milligrams per litre of calcium for one millilitre of standard edta. */
export const HARDNESS_FACTOR = 400;

/** Sodium chloride weighs this much for every part of chloride in it. */
export const SALT_PER_CHLORIDE = 1.65;

/** One milligram per litre is this many pounds in a barrel. */
export const MG_PER_LITRE_TO_LB_PER_BBL = 0.00035;

/**
 * Chloride in milligrams per litre.
 *
 * The normality is the strength of the silver nitrate. The two on a rig are
 * 0.0282 normal for fresh muds and 0.282 normal for salt ones.
 */
export function chloride(millilitresTitrated, sampleMillilitres = 1, normality = 0.0282) {
  const titrated = toNonNegative(millilitresTitrated, 'millilitresTitrated');
  const sample = toPositive(sampleMillilitres, 'sampleMillilitres');
  const strength = toPositive(normality, 'normality');
  return (titrated * strength * CHLORIDE_EQUIVALENT) / sample;
}

/**
 * Sodium chloride in milligrams per litre, worked back from the chloride.
 */
export function saltFromChloride(chlorideMgL) {
  return toNonNegative(chlorideMgL, 'chlorideMgL') * SALT_PER_CHLORIDE;
}

/**
 * Salt as a percentage by weight of the water phase.
 *
 * The filtrate density matters here. A saturated brine is a fifth heavier than
 * fresh water and dividing by ten thousand alone would read the percentage a
 * fifth high.
 */
export function saltPercent(chlorideMgL, filtrateSpecificGravity = 1) {
  const salt = saltFromChloride(chlorideMgL);
  const sg = toPositive(filtrateSpecificGravity, 'filtrateSpecificGravity');
  return divide(salt, 10000 * sg, 'filtrate density');
}

/**
 * Salt in pounds per barrel of water, which is what the mixing order needs.
 */
export function saltLbPerBblWater(chlorideMgL) {
  return saltFromChloride(chlorideMgL) * MG_PER_LITRE_TO_LB_PER_BBL;
}

/**
 * Total hardness as calcium, in milligrams per litre.
 */
export function totalHardness(
  millilitresTitrated,
  sampleMillilitres = 1,
  factor = HARDNESS_FACTOR
) {
  const titrated = toNonNegative(millilitresTitrated, 'millilitresTitrated');
  const sample = toPositive(sampleMillilitres, 'sampleMillilitres');
  return (titrated * toPositive(factor, 'factor')) / sample;
}

/**
 * Soda ash needed to drop calcium out of the water phase, pounds per barrel.
 */
export function sodaAshForCalcium(calciumMgL, waterFraction = 1) {
  const calcium = toNonNegative(calciumMgL, 'calciumMgL');
  const water = toNonNegative(waterFraction, 'waterFraction');
  if (water > 1) {
    throw new Error(`the water fraction ${water} is above one, quote it as a fraction`);
  }
  return 0.000927 * calcium * water * 42;
}

/**
 * How hard the makeup water is, in the words the report uses.
 */
export function describeHardness(calciumMgL) {
  const calcium = toNonNegative(calciumMgL, 'calciumMgL');
  if (calcium < 60) {
    return 'soft';
  }
  if (calcium < 120) {
    return 'moderately hard';
  }
  if (calcium < 240) {
    return 'hard';
  }
  return 'very hard';
}

/**
 * The water phase salinity of an invert emulsion, in milligrams per litre.
 *
 * The chloride is titrated on the whole mud rather than a filtrate, so it has
 * to be put back over the water the retort found, not over the sample.
 */
export function waterPhaseSalinity(chlorideMgL, waterPercent) {
  const water = toPositive(waterPercent, 'waterPercent');
  if (water > 100) {
    throw new Error(`the retort cannot read ${water} percent water`);
  }
  return (toNonNegative(chlorideMgL, 'chlorideMgL') * 100) / water;
}

/**
 * The chemistry block of the report.
 */
export function chemistrySummary({ chlorideMgL, totalHardnessMgL, filtrateSpecificGravity = 1 }) {
  if (chlorideMgL === null || chlorideMgL === undefined) {
    return null;
  }
  return {
    chlorideMgL: round(chlorideMgL, 0),
    saltMgL: round(saltFromChloride(chlorideMgL), 0),
    saltPercentByWeight: round(saltPercent(chlorideMgL, filtrateSpecificGravity), 2),
    totalHardnessMgL: totalHardnessMgL ?? null,
    hardness:
      totalHardnessMgL === null || totalHardnessMgL === undefined
        ? null
        : describeHardness(totalHardnessMgL),
  };
}
