/**
 * The whole circulating system, from the standpipe gauge back to the bell
 * nipple.
 *
 * Surface equipment is handled the way API does it, as an equivalent length of
 * three point eight two six inch drill pipe. That keeps one pressure loss
 * routine rather than a second correlation that behaves differently at low
 * rates, and the four cases below are the standard rig ups.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { pipeLoss, stringLoss, annulusLoss } from './pressure-loss.js';
import { bitSummary } from './bit.js';
import { pipeModel, annularModel } from '../rheology/powerlaw.js';

/**
 * Equivalent length of 3.826 inch drill pipe for each surface rig up.
 *
 * Case one is a small rig with a short standpipe and a two and a half inch
 * hose. Case four is a deep rig with three and a half inch everything.
 */
export const SURFACE_EQUIVALENT_FEET = {
  1: 2600,
  2: 946,
  3: 610,
  4: 424,
};

/** The bore the equivalent lengths are quoted against. */
export const SURFACE_EQUIVALENT_ID = 3.826;

/**
 * Loss through the standpipe, hose, swivel and kelly or top drive.
 */
export function surfaceLoss({ surfaceCase = 3, flowGpm, densityPpg, model }) {
  const length = SURFACE_EQUIVALENT_FEET[surfaceCase];
  if (length === undefined) {
    throw new Error(`there is no surface case ${surfaceCase}, the cases are 1 to 4`);
  }
  return pipeLoss({
    flowGpm,
    idInches: SURFACE_EQUIVALENT_ID,
    lengthFeet: length,
    densityPpg,
    model,
  });
}

/**
 * Every loss in the system, and the standpipe pressure they add up to.
 */
export function systemPressure({
  flowGpm,
  densityPpg,
  dials,
  stringSections,
  annulusRows,
  nozzleThirtySeconds,
  bitDiameterInches,
  surfaceCase = 3,
}) {
  const flow = toNonNegative(flowGpm, 'flowGpm');
  const density = toPositive(densityPpg, 'densityPpg');
  const inside = pipeModel(dials);
  const outside = annularModel(dials);
  const surface = surfaceLoss({ surfaceCase, flowGpm: flow, densityPpg: density, model: inside });
  const string = stringLoss(stringSections, {
    flowGpm: flow,
    densityPpg: density,
    model: inside,
  });
  const annulus = annulusLoss(annulusRows, {
    flowGpm: flow,
    densityPpg: density,
    model: outside,
  });
  const standpipeWithoutBit = surface.psi + string.psi + annulus.psi;
  const bit = bitSummary({
    nozzleThirtySeconds,
    flowGpm: flow,
    densityPpg: density,
    bitDiameterInches,
  });
  const standpipe = standpipeWithoutBit + bit.pressureDropPsi;
  return {
    flowGpm: flow,
    surfacePsi: surface.psi,
    stringPsi: string.psi,
    bitPsi: bit.pressureDropPsi,
    annulusPsi: annulus.psi,
    standpipePsi: round(standpipe, 0),
    bitShare: round(bit.pressureDropPsi / standpipe, 3),
    parasiticPsi: round(standpipeWithoutBit, 0),
    surface,
    string,
    annulus,
    bit: { ...bit, shareOfSystem: round(bit.pressureDropPsi / standpipe, 3) },
  };
}

/**
 * The rate that puts the standpipe on a pressure limit.
 *
 * There is no closed form once the bit and the parasitic losses scale
 * differently, so this walks the rate up until the limit is passed and then
 * bisects. Twenty five steps is plenty for a rate quoted to the nearest
 * gallon.
 */
export function rateForPressure(limitPsi, options) {
  const limit = toPositive(limitPsi, 'limitPsi');
  const at = (rate) => systemPressure({ ...options, flowGpm: rate }).standpipePsi;
  let low = 1;
  let high = 2000;
  if (at(low) > limit) {
    return { flowGpm: 0, standpipePsi: 0, limited: 'below the smallest usable rate' };
  }
  if (at(high) < limit) {
    return { flowGpm: high, standpipePsi: at(high), limited: 'not reached at 2000 gallons' };
  }
  for (let step = 0; step < 25; step += 1) {
    const middle = (low + high) / 2;
    if (at(middle) > limit) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return {
    flowGpm: round(low, 0),
    standpipePsi: round(at(low), 0),
    limited: null,
  };
}

/**
 * How the pressure is split, as the hydraulics sheet prints it.
 */
export function pressureSplit(system) {
  const rows = [
    { part: 'surface equipment', psi: system.surfacePsi },
    { part: 'drill string', psi: system.stringPsi },
    { part: 'bit', psi: system.bitPsi },
    { part: 'annulus', psi: system.annulusPsi },
  ];
  const total = rows.reduce((sum, row) => sum + row.psi, 0);
  return rows.map((row) => ({ ...row, share: round(row.psi / total, 3) }));
}
