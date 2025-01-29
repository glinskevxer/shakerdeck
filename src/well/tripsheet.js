/**
 * The trip sheet.
 *
 * Every stand out, the hole should take the steel that left it, and every
 * stand in it should give the same back. The sheet is a running comparison
 * between what the trip tank actually did and what it should have done, stand
 * by stand, because a difference that builds slowly over twenty stands is
 * invisible on any single one.
 */
import { toPositive, toNonNegative, toNumber, round } from '../util/number.js';

/**
 * What one stand should move, in barrels.
 */
export function standVolume({
  standFeet,
  displacementBblPerFoot,
  capacityBblPerFoot = 0,
  wet = true,
}) {
  const length = toPositive(standFeet, 'standFeet');
  const steel = toNonNegative(displacementBblPerFoot, 'displacementBblPerFoot');
  const bore = toNonNegative(capacityBblPerFoot, 'capacityBblPerFoot');
  return round(length * (wet ? steel + bore : steel), 3);
}

/**
 * Run a sheet of stands against what the trip tank read.
 */
export function runTripSheet({
  direction = 'out',
  standFeet,
  displacementBblPerFoot,
  capacityBblPerFoot = 0,
  wet = true,
  readings,
  thresholdBbl = 5,
}) {
  if (direction !== 'out' && direction !== 'in') {
    throw new Error(`a trip goes in or out, not ${direction}`);
  }
  if (!Array.isArray(readings) || readings.length === 0) {
    throw new Error('there are no trip tank readings on the sheet');
  }
  const perStand = standVolume({ standFeet, displacementBblPerFoot, capacityBblPerFoot, wet });
  const threshold = toNonNegative(thresholdBbl, 'thresholdBbl');
  let expected = 0;
  let actual = 0;
  const rows = readings.map((reading, index) => {
    const moved = toNumber(reading.movedBbl, `stand ${index + 1} movedBbl`);
    expected += perStand;
    actual += moved;
    const difference = actual - expected;
    return {
      stand: index + 1,
      depthFeet: reading.depthFeet ?? null,
      movedBbl: round(moved, 2),
      expectedBbl: round(perStand, 2),
      cumulativeExpectedBbl: round(expected, 2),
      cumulativeActualBbl: round(actual, 2),
      differenceBbl: round(difference, 2),
      overThreshold: Math.abs(difference) >= threshold,
    };
  });
  const finalDifference = actual - expected;
  let verdict = 'on paper';
  if (direction === 'out' && finalDifference <= -threshold) {
    verdict = 'the hole took less than it should have, it may be swabbing in';
  } else if (direction === 'out' && finalDifference >= threshold) {
    verdict = 'the hole took more than it should have, it may be losing';
  } else if (direction === 'in' && finalDifference >= threshold) {
    verdict = 'the hole gave back more than it should have, it may be flowing';
  } else if (direction === 'in' && finalDifference <= -threshold) {
    verdict = 'the hole gave back less than it should have, it may be losing';
  }
  return {
    direction,
    perStandBbl: perStand,
    stands: rows,
    expectedBbl: round(expected, 2),
    actualBbl: round(actual, 2),
    differenceBbl: round(finalDifference, 2),
    firstFlaggedStand: rows.find((row) => row.overThreshold)?.stand ?? null,
    verdict,
    investigate: Math.abs(finalDifference) >= threshold,
  };
}

/**
 * The stand at which a slow drift first became worth acting on.
 *
 * A single stand five barrels out is a reading error. Five stands each a
 * barrel out is the well telling you something, and only the running total
 * sees it.
 */
export function driftOnset(sheet) {
  const flagged = sheet.stands.find((row) => row.overThreshold);
  if (!flagged) {
    return null;
  }
  return {
    stand: flagged.stand,
    depthFeet: flagged.depthFeet,
    differenceBbl: flagged.differenceBbl,
    worstSingleStandBbl: round(
      sheet.stands.reduce(
        (worst, row) => Math.max(worst, Math.abs(row.movedBbl - row.expectedBbl)),
        0
      ),
      2
    ),
  };
}
