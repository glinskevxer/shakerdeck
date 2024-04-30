/**
 * Bulk velocities.
 *
 * The 24.5 constant turns gallons a minute and inches of diameter into feet a
 * minute, and it is the number every annular velocity on every rig is worked
 * with. Feet a minute is what the report prints, because a hand who has spent
 * twenty years watching returns thinks in feet a minute and not in metres a
 * second.
 */
import { toPositive, toNonNegative, round, divide } from '../util/number.js';

/** Gallons a minute over square inches, to feet a minute. */
export const VELOCITY_CONSTANT = 24.5;

/**
 * Velocity inside a pipe, feet a minute.
 */
export function pipeVelocity(flowGpm, idInches) {
  const id = toPositive(idInches, 'idInches');
  return (VELOCITY_CONSTANT * toNonNegative(flowGpm, 'flowGpm')) / (id * id);
}

/**
 * Velocity in an annulus, feet a minute.
 */
export function annularVelocity(flowGpm, holeIdInches, pipeOdInches) {
  const hole = toPositive(holeIdInches, 'holeIdInches');
  const pipe = toNonNegative(pipeOdInches, 'pipeOdInches');
  if (pipe >= hole) {
    throw new Error(`a ${pipe} inch pipe does not fit in a ${hole} inch hole`);
  }
  return (VELOCITY_CONSTANT * toNonNegative(flowGpm, 'flowGpm')) / (hole * hole - pipe * pipe);
}

/**
 * Velocity from a capacity in barrels per foot, which is how a section that
 * has already been measured is worked.
 */
export function velocityFromCapacity(flowGpm, capacityBblPerFoot) {
  const capacity = toPositive(capacityBblPerFoot, 'capacityBblPerFoot');
  return divide(toNonNegative(flowGpm, 'flowGpm'), capacity * 42, 'capacity');
}

/**
 * Feet a second, for the calculations that want it that way round.
 */
export function feetPerSecond(feetPerMinute) {
  return toNonNegative(feetPerMinute, 'feetPerMinute') / 60;
}

/**
 * The hydraulic diameter of an annulus, which is the difference of the two
 * diameters for the slot approximation every field formula uses.
 */
export function hydraulicDiameter(holeIdInches, pipeOdInches) {
  const hole = toPositive(holeIdInches, 'holeIdInches');
  const pipe = toNonNegative(pipeOdInches, 'pipeOdInches');
  if (pipe >= hole) {
    throw new Error(`a ${pipe} inch pipe does not fit in a ${hole} inch hole`);
  }
  return hole - pipe;
}

/**
 * The flow rate that gives a wanted annular velocity, which is the way the
 * question is actually asked on the rig floor.
 */
export function flowForVelocity(velocityFeetPerMinute, holeIdInches, pipeOdInches) {
  const hole = toPositive(holeIdInches, 'holeIdInches');
  const pipe = toNonNegative(pipeOdInches, 'pipeOdInches');
  if (pipe >= hole) {
    throw new Error(`a ${pipe} inch pipe does not fit in a ${hole} inch hole`);
  }
  return (
    (toNonNegative(velocityFeetPerMinute, 'velocityFeetPerMinute') * (hole * hole - pipe * pipe)) /
    VELOCITY_CONSTANT
  );
}

/**
 * Velocity through every length of the annulus, slowest first. The slowest
 * length is where cuttings pile up, and it is almost never the one anybody
 * quotes.
 */
export function annularProfile(rows, flowGpm) {
  return rows
    .map((row) => ({
      holeName: row.holeName,
      pipeName: row.pipeName,
      lengthFeet: row.lengthFeet,
      velocityFeetPerMinute: round(annularVelocity(flowGpm, row.idInches, row.odInches), 1),
    }))
    .sort((a, b) => a.velocityFeetPerMinute - b.velocityFeetPerMinute);
}

/**
 * The slowest length in the annulus.
 */
export function slowestAnnulus(rows, flowGpm) {
  const profile = annularProfile(rows, flowGpm);
  if (profile.length === 0) {
    throw new Error('there is no annulus to work through');
  }
  return profile[0];
}
