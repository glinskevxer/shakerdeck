/**
 * Reynolds numbers and flow regime for a power law fluid.
 *
 * These are the API 13D field forms, which take velocity in feet a second,
 * diameters in inches, density in pounds a gallon and the consistency index in
 * equivalent centipoise.
 *
 * The rheology module produces K in pounds force per hundred square feet times
 * seconds to the n, which is not the same unit, and the two are a factor of
 * 478.8 apart. Feeding the rheology figure straight into these equations reads
 * every Reynolds number about five hundred times high, which puts a laminar
 * annulus firmly in turbulent flow and quietly doubles the pressure loss. The
 * conversion is done here, once, rather than at each call.
 *
 * The critical numbers are not the textbook 2100 and 4000. A shear thinning
 * fluid stays laminar longer than water does, and the transition moves with
 * the flow behaviour index.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/** Pipe form constant. */
export const PIPE_REYNOLDS_CONSTANT = 89100;

/** Annulus form constant. */
export const ANNULAR_REYNOLDS_CONSTANT = 109000;

/**
 * One pound force per hundred square feet times seconds is this many
 * centipoise. It is 4.788 dyne per square centimetre times a hundred.
 */
export const CONSISTENCY_TO_CENTIPOISE = 478.8;

function checkModel(model) {
  const n = toPositive(model?.n, 'n');
  const k = toPositive(model?.k, 'k') * CONSISTENCY_TO_CENTIPOISE;
  return { n, k };
}

/**
 * Reynolds number inside a pipe.
 */
export function reynoldsPipe({ densityPpg, velocityFeetPerSecond, idInches, model }) {
  const { n, k } = checkModel(model);
  const density = toPositive(densityPpg, 'densityPpg');
  const velocity = toNonNegative(velocityFeetPerSecond, 'velocityFeetPerSecond');
  const id = toPositive(idInches, 'idInches');
  if (velocity === 0) {
    return 0;
  }
  return (
    ((PIPE_REYNOLDS_CONSTANT * density * velocity ** (2 - n)) / k) *
    ((0.0416 * id) / (3 + 1 / n)) ** n
  );
}

/**
 * Reynolds number in an annulus, using the slot approximation.
 */
export function reynoldsAnnulus({
  densityPpg,
  velocityFeetPerSecond,
  holeIdInches,
  pipeOdInches,
  model,
}) {
  const { n, k } = checkModel(model);
  const density = toPositive(densityPpg, 'densityPpg');
  const velocity = toNonNegative(velocityFeetPerSecond, 'velocityFeetPerSecond');
  const hole = toPositive(holeIdInches, 'holeIdInches');
  const pipe = toNonNegative(pipeOdInches, 'pipeOdInches');
  if (pipe >= hole) {
    throw new Error(`a ${pipe} inch pipe does not fit in a ${hole} inch hole`);
  }
  if (velocity === 0) {
    return 0;
  }
  return (
    ((ANNULAR_REYNOLDS_CONSTANT * density * velocity ** (2 - n)) / k) *
    ((0.0208 * (hole - pipe)) / (2 + 1 / n)) ** n
  );
}

/**
 * The two critical Reynolds numbers, which move with the index.
 */
export function criticalReynolds(n) {
  const index = toPositive(n, 'n');
  return {
    laminarUpTo: 3470 - 1370 * index,
    turbulentFrom: 4270 - 1370 * index,
  };
}

/**
 * Which regime a flow is in.
 */
export function regime(reynolds, n) {
  const re = toNonNegative(reynolds, 'reynolds');
  const { laminarUpTo, turbulentFrom } = criticalReynolds(n);
  if (re <= laminarUpTo) {
    return 'laminar';
  }
  if (re >= turbulentFrom) {
    return 'turbulent';
  }
  return 'transitional';
}

/**
 * Fanning friction factor.
 *
 * Laminar is the exact result. Turbulent is the Dodge and Metzner correlation,
 * which is what every hydraulics sheet in the field uses. In the transition
 * the two are blended across, because a step change there puts a kink in a
 * pressure loss curve that nobody believes.
 */
export function frictionFactor(reynolds, n) {
  const re = toNonNegative(reynolds, 'reynolds');
  const index = toPositive(n, 'n');
  if (re === 0) {
    return 0;
  }
  const { laminarUpTo, turbulentFrom } = criticalReynolds(index);
  const laminar = 16 / re;
  const a = (Math.log10(index) + 3.93) / 50;
  const b = (1.75 - Math.log10(index)) / 7;
  const turbulent = a / re ** b;
  if (re <= laminarUpTo) {
    return laminar;
  }
  if (re >= turbulentFrom) {
    return turbulent;
  }
  const share = (re - laminarUpTo) / (turbulentFrom - laminarUpTo);
  return laminar * (1 - share) + turbulent * share;
}

/**
 * The regime block for one length of hole.
 */
export function describeFlow(reynolds, n) {
  return {
    reynolds: round(reynolds, 0),
    regime: regime(reynolds, n),
    frictionFactor: round(frictionFactor(reynolds, n), 5),
    ...criticalReynolds(n),
  };
}
