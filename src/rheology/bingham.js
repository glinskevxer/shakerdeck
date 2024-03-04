/**
 * The Bingham plastic model.
 *
 * Two numbers off the six hundred and three hundred readings. It is the
 * coarsest of the three models the desk carries and it is still what the
 * daily report leads with, because every hand on the rig reads it.
 */
import { toNonNegative, round } from '../util/number.js';
import { dialAt } from './dial.js';

/**
 * Plastic viscosity in centipoise: the resistance from solids grinding past
 * each other. It goes up when solids build and it does not come down with
 * thinner, which is why it is watched rather than treated.
 */
export function plasticViscosity(readings) {
  const six = dialAt(readings, 600);
  const three = dialAt(readings, 300);
  const pv = six - three;
  if (pv < 0) {
    throw new Error(`plastic viscosity came out negative at ${pv}`);
  }
  return pv;
}

/**
 * Yield point in pounds force per hundred square feet: the attraction between
 * particles at rest. This is the one that gets treated.
 */
export function yieldPoint(readings) {
  const three = dialAt(readings, 300);
  return three - plasticViscosity(readings);
}

/**
 * Apparent viscosity in centipoise, which is half the six hundred reading.
 */
export function apparentViscosity(readings) {
  return dialAt(readings, 600) / 2;
}

/**
 * The ratio the mud engineer treats against. A yield point well below the
 * plastic viscosity carries cuttings badly however high the total viscosity is.
 */
export function ypPvRatio(readings) {
  const pv = plasticViscosity(readings);
  if (pv === 0) {
    throw new Error('plastic viscosity is zero, the ratio has no meaning');
  }
  return yieldPoint(readings) / pv;
}

/**
 * Shear stress the model predicts at a shear rate, in lbf per hundred square
 * feet. The model is a straight line, so it overstates the stress badly at the
 * low shear rates that matter in a wide annulus.
 */
export function stressAt(readings, shearRatePerSecond) {
  const rate = toNonNegative(shearRatePerSecond, 'shearRatePerSecond');
  const pv = plasticViscosity(readings);
  const yp = yieldPoint(readings);
  return yp + (pv * rate) / 511;
}

/**
 * Gel strengths, in the order the report prints them.
 */
export function gels({ tenSecond, tenMinute, thirtyMinute } = {}) {
  const ten = toNonNegative(tenSecond ?? 0, 'tenSecond');
  const minute = toNonNegative(tenMinute ?? ten, 'tenMinute');
  const half = thirtyMinute === undefined ? null : toNonNegative(thirtyMinute, 'thirtyMinute');
  if (minute < ten) {
    throw new Error(`the ten minute gel ${minute} is below the ten second gel ${ten}`);
  }
  if (half !== null && half < minute) {
    throw new Error(`the thirty minute gel ${half} is below the ten minute gel ${minute}`);
  }
  return {
    tenSecond: ten,
    tenMinute: minute,
    thirtyMinute: half,
    riseTenToTen: round(minute - ten, 2),
    progressive: minute - ten > Math.max(2, ten * 0.5),
  };
}

/**
 * The Bingham summary as the report prints it.
 */
export function binghamSummary(readings) {
  return {
    plasticViscosity: round(plasticViscosity(readings), 1),
    yieldPoint: round(yieldPoint(readings), 1),
    apparentViscosity: round(apparentViscosity(readings), 1),
    ypPvRatio: round(ypPvRatio(readings), 2),
  };
}
