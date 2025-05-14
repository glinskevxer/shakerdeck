/**
 * Readings off a direct indicating viscometer.
 *
 * The instrument is a Fann 35 with the standard R1 rotor, B1 bob and F1
 * spring, which is what the constants below assume. Anything else on the rig
 * needs a spring factor and the readings scaled before they reach this module.
 */
import { toNonNegative, toPositive, round } from '../util/number.js';

/** Shear rate in reciprocal seconds for one revolution per minute. */
export const SHEAR_RATE_PER_RPM = 1.7023;

/** Shear stress in lbf per hundred square feet for one dial degree. */
export const STRESS_PER_DIAL = 1.0678;

/** Shear stress in dyne per square centimetre for one dial degree. */
export const DYNE_PER_DIAL = 5.11;

/** The six speeds on the gearbox, fastest first. */
export const STANDARD_SPEEDS = [600, 300, 200, 100, 6, 3];

export function shearRate(rpm) {
  return toNonNegative(rpm, 'rpm') * SHEAR_RATE_PER_RPM;
}

export function shearStress(dial) {
  return toNonNegative(dial, 'dial') * STRESS_PER_DIAL;
}

export function shearStressDyne(dial) {
  return toNonNegative(dial, 'dial') * DYNE_PER_DIAL;
}

/**
 * Viscosity in centipoise at the speed the reading was taken at. This is the
 * point viscosity, not the plastic viscosity.
 */
export function effectiveViscosity(dial, rpm) {
  return (300 * toNonNegative(dial, 'dial')) / toPositive(rpm, 'rpm');
}

/**
 * Read a set of dial readings keyed by speed.
 *
 * A reading at a higher speed that comes out below a lower one is a stuck
 * instrument or a transposed pair on the tally, and it will otherwise produce
 * a negative plastic viscosity three functions later, so it is caught here.
 */
export function readDials(readings) {
  // A set that has already been read comes back as a Map, and reading it a
  // second time used to produce an empty set rather than the same one, because
  // Object.entries of a Map is empty. Anything that read a check twice, which
  // the reports do, quietly lost the rheology.
  if (readings instanceof Map) {
    return readings;
  }
  if (!readings || typeof readings !== 'object') {
    throw new Error('dial readings must be given as an object keyed by speed');
  }
  const out = new Map();
  for (const [key, value] of Object.entries(readings)) {
    const rpm = toPositive(key, 'speed');
    out.set(rpm, toNonNegative(value, `dial at ${rpm} rpm`));
  }
  if (out.size === 0) {
    throw new Error('there are no dial readings');
  }
  const speeds = [...out.keys()].sort((a, b) => a - b);
  for (let i = 1; i < speeds.length; i += 1) {
    const slow = out.get(speeds[i - 1]);
    const fast = out.get(speeds[i]);
    if (fast < slow) {
      throw new Error(
        `the reading at ${speeds[i]} rpm is ${fast}, below the ${slow} at ${speeds[i - 1]} rpm`
      );
    }
  }
  return out;
}

/**
 * Pull one speed out of a reading set, complaining by name when it is missing.
 */
export function dialAt(readings, rpm) {
  const dials = readings instanceof Map ? readings : readDials(readings);
  if (!dials.has(rpm)) {
    throw new Error(`there is no reading at ${rpm} rpm`);
  }
  return dials.get(rpm);
}

/**
 * The flow curve as measured: every reading turned into a shear rate and a
 * shear stress, slowest first.
 */
export function flowCurve(readings) {
  const dials = readings instanceof Map ? readings : readDials(readings);
  return [...dials.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rpm, dial]) => ({
      rpm,
      dial,
      shearRate: round(shearRate(rpm), 3),
      shearStress: round(shearStress(dial), 3),
      effectiveViscosity: round(effectiveViscosity(dial, rpm), 1),
    }));
}

/**
 * True when a set of readings covers the speeds the model fits need.
 */
export function hasStandardSet(readings) {
  const dials = readings instanceof Map ? readings : readDials(readings);
  return STANDARD_SPEEDS.every((rpm) => dials.has(rpm));
}
