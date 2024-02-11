/**
 * Mud weight lives in four units on the same rig and the crew will quote
 * whichever one their gauge shows. The desk keeps every calculation in pounds
 * per gallon and converts at the edges.
 *
 * Constants are the API 13B-1 values, not the rounded rules of thumb, with the
 * rules of thumb kept beside them where a report is expected to match a hand
 * calculation.
 */
import { toNumber, toPositive, round, divide } from '../util/number.js';

/** Density of fresh water at 4 degrees C, pounds per gallon. */
export const WATER_PPG = 8.3454;

/** Pounds per cubic foot in one pound per gallon. */
export const PCF_PER_PPG = 7.480519;

/**
 * Pressure gradient constant. The rig uses 0.052 on the tour sheet, which is
 * 0.05194 rounded, and a report that disagrees with the driller by a tenth of
 * a psi per hundred feet gets argued about, so 0.052 is what the desk prints.
 */
export const GRADIENT_PER_PPG = 0.052;

/** The unrounded gradient constant, for anything that is compared to a gauge. */
export const GRADIENT_PER_PPG_EXACT = 0.0519481;

export function ppgToSg(ppg) {
  return divide(toPositive(ppg, 'ppg'), WATER_PPG, 'water density');
}

export function sgToPpg(sg) {
  return toPositive(sg, 'sg') * WATER_PPG;
}

export function ppgToPcf(ppg) {
  return toPositive(ppg, 'ppg') * PCF_PER_PPG;
}

export function pcfToPpg(pcf) {
  return divide(toPositive(pcf, 'pcf'), PCF_PER_PPG, 'conversion');
}

/**
 * Pressure gradient in psi per foot.
 */
export function ppgToGradient(ppg, { exact = false } = {}) {
  const constant = exact ? GRADIENT_PER_PPG_EXACT : GRADIENT_PER_PPG;
  return toPositive(ppg, 'ppg') * constant;
}

export function gradientToPpg(gradient, { exact = false } = {}) {
  const constant = exact ? GRADIENT_PER_PPG_EXACT : GRADIENT_PER_PPG;
  return divide(toPositive(gradient, 'gradient'), constant, 'gradient constant');
}

/**
 * Hydrostatic head of a column of mud, in psi.
 *
 * True vertical depth, never measured depth. Passing measured depth in a
 * deviated hole is the single most common way a hydrostatic number comes out
 * wrong, so the argument is named for it.
 */
export function hydrostatic(ppg, tvdFeet, options = {}) {
  return ppgToGradient(ppg, options) * toNumber(tvdFeet, 'tvdFeet');
}

/**
 * The mud weight that puts a given pressure at a given true vertical depth.
 */
export function equivalentWeight(pressurePsi, tvdFeet, options = {}) {
  const constant = options.exact ? GRADIENT_PER_PPG_EXACT : GRADIENT_PER_PPG;
  return divide(
    toNumber(pressurePsi, 'pressurePsi'),
    constant * toPositive(tvdFeet, 'tvdFeet'),
    'depth'
  );
}

/**
 * Pore pressure or fracture pressure quoted as a gradient, converted to the
 * mud weight the programme will write.
 */
export function pressureGradientToPpg(psiPerFoot, options = {}) {
  return gradientToPpg(psiPerFoot, options);
}

/**
 * A density reading with every unit filled in, for a report line.
 */
export function describeDensity(ppg, decimals = 2) {
  const value = toPositive(ppg, 'ppg');
  return {
    ppg: round(value, decimals),
    sg: round(ppgToSg(value), 3),
    pcf: round(ppgToPcf(value), 1),
    gradientPsiPerFoot: round(ppgToGradient(value), 4),
  };
}
