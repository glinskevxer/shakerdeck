/**
 * Capacities and displacements.
 *
 * Everything here is the 1029.4 family of formulae the industry uses, which is
 * the area of a circle in square inches divided by the cubic inches in a
 * barrel, per foot of length. Diameters are inches, lengths are feet, answers
 * are barrels or barrels per foot.
 */
import { toPositive, toNonNegative, toNumber, round } from '../util/number.js';
import { readAnnulus } from './annulus-check.js';

/** Cubic inches per barrel divided by twelve, the constant every hand uses. */
export const CAPACITY_CONSTANT = 1029.4;

/**
 * Capacity of an open bore, barrels per foot.
 */
export function boreCapacity(idInches) {
  const id = toPositive(idInches, 'idInches');
  return (id * id) / CAPACITY_CONSTANT;
}

/**
 * Capacity of the annulus between a hole and a string, barrels per foot.
 */
export function annularCapacity(holeIdInches, pipeOdInches) {
  const { hole, pipe } = readAnnulus(holeIdInches, pipeOdInches);
  return (hole * hole - pipe * pipe) / CAPACITY_CONSTANT;
}

/**
 * Steel displacement of a length of pipe, barrels per foot. This is the volume
 * the pipe body itself takes up, which is what the trip tank sees when the
 * string comes out wet.
 */
export function steelDisplacement(odInches, idInches) {
  const od = toPositive(odInches, 'odInches');
  const id = toNonNegative(idInches, 'idInches');
  if (id >= od) {
    throw new Error(`inside diameter ${id} is not smaller than outside diameter ${od}`);
  }
  return (od * od - id * id) / CAPACITY_CONSTANT;
}

/**
 * Displacement of a string run with a float or a plugged bit, barrels per
 * foot. Nothing fills the bore, so the whole outside area displaces.
 */
export function closedEndDisplacement(odInches) {
  return boreCapacity(odInches);
}

/**
 * Total volume for a capacity and a length.
 */
export function volumeOver(capacityBblPerFoot, lengthFeet) {
  return (
    toNonNegative(capacityBblPerFoot, 'capacityBblPerFoot') * toNumber(lengthFeet, 'lengthFeet')
  );
}

/**
 * Feet of hole a volume fills at a given capacity.
 */
export function lengthFor(volumeBbl, capacityBblPerFoot) {
  const capacity = toPositive(capacityBblPerFoot, 'capacityBblPerFoot');
  return toNumber(volumeBbl, 'volumeBbl') / capacity;
}

/**
 * A pipe section described the way a tally describes it, with both capacities
 * worked out once.
 */
export function describeSection(section) {
  const name = String(section?.name ?? 'section');
  const od = toPositive(section?.odInches, `${name} odInches`);
  const id = toPositive(section?.idInches, `${name} idInches`);
  const length = toNonNegative(section?.lengthFeet, `${name} lengthFeet`);
  const capacity = boreCapacity(id);
  const displacement = steelDisplacement(od, id);
  return {
    name,
    odInches: od,
    idInches: id,
    lengthFeet: length,
    capacityBblPerFoot: round(capacity, 5),
    displacementBblPerFoot: round(displacement, 5),
    capacityBbl: round(capacity * length, 2),
    displacementBbl: round(displacement * length, 2),
    totalBbl: round((capacity + displacement) * length, 2),
  };
}
