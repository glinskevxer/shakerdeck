/**
 * Mud pump output and circulating times.
 *
 * Output is worked out from the liner size and the stroke length rather than
 * read off the pump plate, because the plate is right for a new pump and the
 * volumetric efficiency on a rig that has been running for a year is not.
 */
import { toPositive, toNonNegative, toNumber, round, divide } from '../util/number.js';
import { GALLONS_PER_BARREL } from '../units/measure.js';

/** Triplex single acting constant: three cylinders, cubic inches to barrels. */
export const TRIPLEX_CONSTANT = 0.000243;

/** Duplex double acting constant: two cylinders, both ends, less the rod. */
export const DUPLEX_CONSTANT = 0.000162;

function efficiencyOf(value) {
  const eff = toPositive(value ?? 1, 'efficiency');
  if (eff > 1) {
    throw new Error(`efficiency ${eff} is above one, quote it as a fraction`);
  }
  return eff;
}

/**
 * Output of a triplex pump in barrels per stroke.
 */
export function triplexOutput(linerInches, strokeInches, efficiency = 1) {
  const liner = toPositive(linerInches, 'linerInches');
  const stroke = toPositive(strokeInches, 'strokeInches');
  return TRIPLEX_CONSTANT * liner * liner * stroke * efficiencyOf(efficiency);
}

/**
 * Output of a double acting duplex pump in barrels per stroke. The rod takes
 * up part of the back end, which is why it is subtracted once and not twice.
 */
export function duplexOutput(linerInches, rodInches, strokeInches, efficiency = 1) {
  const liner = toPositive(linerInches, 'linerInches');
  const rod = toNonNegative(rodInches, 'rodInches');
  const stroke = toPositive(strokeInches, 'strokeInches');
  if (rod >= liner) {
    throw new Error(`rod ${rod} does not fit inside a ${liner} inch liner`);
  }
  return DUPLEX_CONSTANT * stroke * (2 * liner * liner - rod * rod) * efficiencyOf(efficiency);
}

/**
 * Output for a pump described the way the tour sheet describes it.
 */
export function pumpOutput(pump) {
  const type = String(pump?.type ?? 'triplex').toLowerCase();
  if (type === 'triplex') {
    return triplexOutput(pump.linerInches, pump.strokeInches, pump.efficiency ?? 1);
  }
  if (type === 'duplex') {
    return duplexOutput(pump.linerInches, pump.rodInches, pump.strokeInches, pump.efficiency ?? 1);
  }
  throw new Error(`unknown pump type: ${pump.type}`);
}

/**
 * Flow rate in gallons per minute from output and stroke rate.
 */
export function flowRateGpm(bblPerStroke, strokesPerMinute) {
  return (
    toNonNegative(bblPerStroke, 'bblPerStroke') *
    toNonNegative(strokesPerMinute, 'strokesPerMinute') *
    GALLONS_PER_BARREL
  );
}

/**
 * Flow rate in barrels per minute.
 */
export function flowRateBpm(bblPerStroke, strokesPerMinute) {
  return (
    toNonNegative(bblPerStroke, 'bblPerStroke') *
    toNonNegative(strokesPerMinute, 'strokesPerMinute')
  );
}

/**
 * Strokes needed to move a volume.
 */
export function strokesFor(volumeBbl, bblPerStroke) {
  return divide(
    toNonNegative(volumeBbl, 'volumeBbl'),
    toPositive(bblPerStroke, 'bblPerStroke'),
    'bblPerStroke'
  );
}

/**
 * Minutes to move a volume at a stroke rate.
 */
export function minutesFor(volumeBbl, bblPerStroke, strokesPerMinute) {
  const rate = flowRateBpm(bblPerStroke, strokesPerMinute);
  return divide(toNonNegative(volumeBbl, 'volumeBbl'), rate, 'pump rate');
}

/**
 * The circulating summary a driller asks for: strokes and minutes to surface,
 * to the bit, and for a full circulation.
 */
export function circulationTimes({ stringBbl, annulusBbl, bblPerStroke, strokesPerMinute }) {
  const string = toNonNegative(stringBbl, 'stringBbl');
  const annulus = toNonNegative(annulusBbl, 'annulusBbl');
  const perStroke = toPositive(bblPerStroke, 'bblPerStroke');
  const spm = toPositive(strokesPerMinute, 'strokesPerMinute');
  const total = string + annulus;
  return {
    surfaceToBitStrokes: round(string / perStroke, 0),
    surfaceToBitMinutes: round(string / (perStroke * spm), 1),
    bottomsUpStrokes: round(annulus / perStroke, 0),
    bottomsUpMinutes: round(annulus / (perStroke * spm), 1),
    fullCirculationStrokes: round(total / perStroke, 0),
    fullCirculationMinutes: round(total / (perStroke * spm), 1),
    totalSystemBbl: round(total, 1),
  };
}

/**
 * Lag depth: how far up the annulus a sample cut at a given stroke count has
 * travelled. Used to tie a cuttings sample back to the depth it came from.
 */
export function lagStrokes(annulusBbl, bblPerStroke) {
  return strokesFor(annulusBbl, bblPerStroke);
}

/**
 * Pump pressure changes with the square of the stroke rate when the flow stays
 * in the same regime. Used to work a new standpipe pressure after a rate change.
 */
export function pressureAtNewRate(pressurePsi, oldSpm, newSpm) {
  const p = toNonNegative(pressurePsi, 'pressurePsi');
  const from = toPositive(oldSpm, 'oldSpm');
  const to = toNonNegative(newSpm, 'newSpm');
  return p * (to / from) ** 2;
}

/**
 * A pump described for the report, with output at the running rate.
 */
export function describePump(pump, strokesPerMinute) {
  const perStroke = pumpOutput(pump);
  const spm = toNonNegative(strokesPerMinute, 'strokesPerMinute');
  return {
    label: String(pump?.label ?? pump?.type ?? 'pump'),
    bblPerStroke: round(perStroke, 4),
    strokesPerMinute: toNumber(spm, 'strokesPerMinute'),
    gpm: round(flowRateGpm(perStroke, spm), 1),
    bpm: round(flowRateBpm(perStroke, spm), 2),
  };
}
