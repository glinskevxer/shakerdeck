/**
 * Equivalent circulating density.
 *
 * The mud weighs what the balance says on the way in and rather more than that
 * at the bottom of the hole while the pump is running, because the annular
 * friction and the cuttings the mud is carrying both sit on top of the
 * hydrostatic head. On a well with a narrow window between what will flow and
 * what will break down, this is the number that decides the pump rate.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { GRADIENT_PER_PPG, hydrostatic } from '../units/density.js';

/**
 * Equivalent circulating density in pounds a gallon.
 */
export function equivalentCirculatingDensity({ weightPpg, annularLossPsi, tvdFeet }) {
  const weight = toPositive(weightPpg, 'weightPpg');
  const loss = toNonNegative(annularLossPsi, 'annularLossPsi');
  const depth = toPositive(tvdFeet, 'tvdFeet');
  return weight + loss / (GRADIENT_PER_PPG * depth);
}

/**
 * How much the cuttings in the annulus add to the density.
 *
 * The concentration comes off the rate of penetration and the flow rate. At a
 * hundred feet an hour in a twelve and a quarter inch hole at six hundred
 * gallons a minute it is under a tenth of a pound, and at twice the penetration
 * and half the rate it is enough to matter.
 */
export function cuttingsLoading({
  penetrationFeetPerHour,
  bitDiameterInches,
  flowGpm,
  cuttingsSg = 2.6,
  weightPpg,
}) {
  const rate = toNonNegative(penetrationFeetPerHour, 'penetrationFeetPerHour');
  const bit = toPositive(bitDiameterInches, 'bitDiameterInches');
  const flow = toPositive(flowGpm, 'flowGpm');
  const sg = toPositive(cuttingsSg, 'cuttingsSg');
  const weight = toPositive(weightPpg, 'weightPpg');
  // Cuttings made per minute in gallons, against the mud pumped in the same
  // minute. Both are volumes, so the ratio is the volume fraction.
  const cuttingsGpm = ((Math.PI / 4) * bit * bit * (rate / 60) * 12) / 231;
  const fraction = cuttingsGpm / (flow + cuttingsGpm);
  const cuttingsPpg = sg * 8.3454;
  return {
    volumeFraction: round(fraction, 5),
    addedPpg: round(fraction * (cuttingsPpg - weight), 3),
  };
}

/**
 * Density at the bottom of the hole with everything in it.
 */
export function circulatingDensity({ weightPpg, annularLossPsi, tvdFeet, cuttings = null }) {
  const base = equivalentCirculatingDensity({ weightPpg, annularLossPsi, tvdFeet });
  const added = cuttings ? cuttingsLoading({ ...cuttings, weightPpg }).addedPpg : 0;
  return {
    weightPpg: round(toPositive(weightPpg, 'weightPpg'), 2),
    frictionPpg: round(base - weightPpg, 3),
    cuttingsPpg: round(added, 3),
    ecdPpg: round(base + added, 2),
    bottomHolePsi: round(hydrostatic(base + added, tvdFeet), 0),
  };
}

/**
 * How much room is left before the formation breaks down.
 *
 * Both gradients are quoted as an equivalent mud weight, which is how a
 * drilling programme writes them.
 */
export function fractureMargin({ ecdPpg, fractureGradientPpg }) {
  const ecd = toPositive(ecdPpg, 'ecdPpg');
  const fracture = toPositive(fractureGradientPpg, 'fractureGradientPpg');
  const margin = fracture - ecd;
  return {
    marginPpg: round(margin, 2),
    breaking: margin <= 0,
    fractureTight: margin > 0 && margin < 0.3,
  };
}

/**
 * How much room is left before the well flows.
 */
export function poreMargin({ weightPpg, porePressurePpg }) {
  const weight = toPositive(weightPpg, 'weightPpg');
  const pore = toPositive(porePressurePpg, 'porePressurePpg');
  const margin = weight - pore;
  return {
    overbalancePpg: round(margin, 2),
    underbalanced: margin < 0,
    overbalanceTight: margin >= 0 && margin < 0.3,
  };
}

/**
 * The whole window, as the report prints it.
 *
 * The two margins each carry their own tight flag rather than sharing one.
 * They were both called tight to begin with and the second spread quietly
 * overwrote the first, so a well that was half a pound off flowing read as
 * comfortable because the fracture margin happened to be wide.
 */
export function densityWindow({
  weightPpg,
  annularLossPsi,
  tvdFeet,
  porePressurePpg,
  fractureGradientPpg,
  cuttings = null,
}) {
  const circulating = circulatingDensity({ weightPpg, annularLossPsi, tvdFeet, cuttings });
  return {
    ...circulating,
    porePressurePpg,
    fractureGradientPpg,
    ...poreMargin({ weightPpg, porePressurePpg }),
    ...fractureMargin({ ecdPpg: circulating.ecdPpg, fractureGradientPpg }),
  };
}
