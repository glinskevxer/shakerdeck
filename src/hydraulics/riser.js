/**
 * Working offshore, where part of the hole is not hole.
 *
 * Between the rig floor and the sea bed there is riser, and the mud in it is
 * holding pressure on the well the same as the mud in the hole. If the riser
 * is disconnected, seawater takes its place, and the well is underbalanced by
 * the difference unless the mud was heavy enough to allow for it.
 *
 * That allowance is the riser margin, and on a deep water well it is a large
 * number.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { GRADIENT_PER_PPG } from '../units/density.js';

/** Seawater, pounds a gallon. */
export const SEAWATER_PPG = 8.55;

/**
 * True vertical depth below the mud line, which is the part that is hole.
 */
export function belowMudLine({ totalTvdFeet, waterDepthFeet, airGapFeet = 0 }) {
  const total = toPositive(totalTvdFeet, 'totalTvdFeet');
  const water = toNonNegative(waterDepthFeet, 'waterDepthFeet');
  const air = toNonNegative(airGapFeet, 'airGapFeet');
  const below = total - water - air;
  if (below <= 0) {
    throw new Error(`a well ${total} feet deep in ${water} feet of water has no hole in it`);
  }
  return round(below, 1);
}

/**
 * The extra mud weight that keeps the well balanced with the riser gone.
 */
export function riserMargin({
  mudPpg,
  totalTvdFeet,
  waterDepthFeet,
  airGapFeet = 0,
  seawaterPpg = SEAWATER_PPG,
}) {
  const mud = toPositive(mudPpg, 'mudPpg');
  const sea = toPositive(seawaterPpg, 'seawaterPpg');
  const water = toNonNegative(waterDepthFeet, 'waterDepthFeet');
  const air = toNonNegative(airGapFeet, 'airGapFeet');
  const below = belowMudLine({ totalTvdFeet, waterDepthFeet, airGapFeet });
  return round(((mud - sea) * (water + air)) / below, 3);
}

/**
 * What the well actually has under it with the riser disconnected.
 */
export function disconnectedPressure({
  mudPpg,
  totalTvdFeet,
  waterDepthFeet,
  airGapFeet = 0,
  seawaterPpg = SEAWATER_PPG,
}) {
  const below = belowMudLine({ totalTvdFeet, waterDepthFeet, airGapFeet });
  const water = toNonNegative(waterDepthFeet, 'waterDepthFeet');
  const connected = GRADIENT_PER_PPG * toPositive(mudPpg, 'mudPpg') * totalTvdFeet;
  const disconnected =
    GRADIENT_PER_PPG * toPositive(seawaterPpg, 'seawaterPpg') * water +
    GRADIENT_PER_PPG * mudPpg * below;
  return {
    connectedPsi: round(connected, 0),
    disconnectedPsi: round(disconnected, 0),
    lostPsi: round(connected - disconnected, 0),
    equivalentPpg: round((connected - disconnected) / (GRADIENT_PER_PPG * totalTvdFeet), 3),
  };
}

/**
 * Whether the mud in the pits already carries the margin.
 */
export function marginCheck({
  mudPpg,
  porePressurePpg,
  totalTvdFeet,
  waterDepthFeet,
  airGapFeet = 0,
}) {
  const margin = riserMargin({ mudPpg, totalTvdFeet, waterDepthFeet, airGapFeet });
  const pore = toPositive(porePressurePpg, 'porePressurePpg');
  const overbalance = toPositive(mudPpg, 'mudPpg') - pore;
  return {
    riserMarginPpg: margin,
    overbalancePpg: round(overbalance, 3),
    carriesTheMargin: overbalance >= margin,
    shortByPpg: overbalance >= margin ? 0 : round(margin - overbalance, 3),
  };
}

/**
 * Choke line friction, which is what a deep water kill is really limited by.
 *
 * It is worked here as an equivalent weight at the shoe, because that is the
 * form the number is used in.
 */
export function chokeLineFriction({ frictionPsi, shoeTvdFeet }) {
  const friction = toNonNegative(frictionPsi, 'frictionPsi');
  const shoe = toPositive(shoeTvdFeet, 'shoeTvdFeet');
  return round(friction / (GRADIENT_PER_PPG * shoe), 3);
}
