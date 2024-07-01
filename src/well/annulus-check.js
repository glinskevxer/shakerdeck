/**
 * One place to read a hole and a pipe diameter and be sure they make an
 * annulus.
 *
 * Six modules were each doing this with their own wording, and three of the
 * six worded the error differently enough that a test written against one did
 * not catch the same mistake in another.
 */
import { toPositive, toNonNegative } from '../util/number.js';

/**
 * Read a hole and a pipe diameter, returning both and the gap between them.
 *
 * A pipe of zero is an empty hole, which is a real case on a wiper trip, so it
 * is allowed. A pipe that is at or over the hole is not.
 */
export function readAnnulus(holeIdInches, pipeOdInches, { allowEmpty = true } = {}) {
  const hole = toPositive(holeIdInches, 'holeIdInches');
  const pipe = allowEmpty
    ? toNonNegative(pipeOdInches, 'pipeOdInches')
    : toPositive(pipeOdInches, 'pipeOdInches');
  if (pipe >= hole) {
    throw new Error(`a ${pipe} inch pipe does not fit in a ${hole} inch hole`);
  }
  return { hole, pipe, gap: hole - pipe };
}
