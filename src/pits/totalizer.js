/**
 * The pit volume totalizer.
 *
 * Every tank that is lined up on the active system adds to one number, and the
 * change in that number over a tour is the only thing on the rig that says
 * whether the well is taking mud or giving it back. Tanks that are not lined
 * up have to be left out, which sounds obvious until a reserve pit gets
 * transferred into and the totalizer reads a gain nobody can explain.
 */
import { toNumber, toNonNegative, round } from '../util/number.js';
import { tankVolume, describeTank } from './geometry.js';

/**
 * Total the tanks that are on the active system.
 */
export function activeVolume(tanks, levels) {
  let total = 0;
  const rows = [];
  for (const tank of tanks) {
    const level = levels?.[tank.name];
    if (level === undefined || level === null) {
      throw new Error(`there is no level reading for ${tank.name}`);
    }
    const volume = tankVolume(tank, level);
    rows.push({ ...describeTank(tank, level), active: tank.active !== false });
    if (tank.active !== false) {
      total += volume;
    }
  }
  return { tanks: rows, activeBbl: round(total, 1) };
}

/**
 * The change between two readings, and what it means.
 *
 * The threshold is the volume the crew will act on rather than a physical
 * limit. Ten barrels on a well with a hundred foot of open hole is noise and
 * on a well drilling ahead into a known sand it is a kick.
 */
export function pitChange({ beforeBbl, afterBbl, thresholdBbl = 10 }) {
  const before = toNumber(beforeBbl, 'beforeBbl');
  const after = toNumber(afterBbl, 'afterBbl');
  const threshold = toNonNegative(thresholdBbl, 'thresholdBbl');
  const change = after - before;
  let verdict = 'steady';
  if (change >= threshold) {
    verdict = 'gain';
  } else if (change <= -threshold) {
    verdict = 'loss';
  }
  return {
    beforeBbl: round(before, 1),
    afterBbl: round(after, 1),
    changeBbl: round(change, 1),
    verdict,
    overThreshold: Math.abs(change) >= threshold,
  };
}

/**
 * What the trip tank should have given back for a length of pipe pulled.
 *
 * Pulling wet, the hole takes the whole outside area of the steel plus what
 * was in the bore. Pulling dry it takes only the steel.
 */
export function tripFill({
  lengthFeet,
  displacementBblPerFoot,
  capacityBblPerFoot = 0,
  wet = true,
}) {
  const length = toNonNegative(lengthFeet, 'lengthFeet');
  const steel = toNonNegative(displacementBblPerFoot, 'displacementBblPerFoot');
  const bore = toNonNegative(capacityBblPerFoot, 'capacityBblPerFoot');
  const perFoot = wet ? steel + bore : steel;
  return round(perFoot * length, 2);
}

/**
 * Compare what the trip tank actually gave back with what it should have.
 *
 * A hole that takes less than it should is swabbing something in. A hole that
 * takes more is losing it somewhere.
 */
export function tripCheck({ expectedBbl, actualBbl, thresholdBbl = 5 }) {
  const expected = toNumber(expectedBbl, 'expectedBbl');
  const actual = toNumber(actualBbl, 'actualBbl');
  const threshold = toNonNegative(thresholdBbl, 'thresholdBbl');
  const difference = actual - expected;
  let verdict = 'on paper';
  if (difference <= -threshold) {
    verdict = 'took less than it should have';
  } else if (difference >= threshold) {
    verdict = 'took more than it should have';
  }
  return {
    expectedBbl: round(expected, 2),
    actualBbl: round(actual, 2),
    differenceBbl: round(difference, 2),
    verdict,
    investigate: Math.abs(difference) >= threshold,
  };
}

/**
 * Run a set of readings taken over a tour into a trend.
 */
export function pitTrend(readings, { thresholdBbl = 10 } = {}) {
  if (!Array.isArray(readings) || readings.length < 2) {
    throw new Error('a trend needs at least two readings');
  }
  const rows = [];
  for (let i = 1; i < readings.length; i += 1) {
    rows.push({
      from: readings[i - 1].time,
      to: readings[i].time,
      ...pitChange({
        beforeBbl: readings[i - 1].activeBbl,
        afterBbl: readings[i].activeBbl,
        thresholdBbl,
      }),
    });
  }
  const net = readings.at(-1).activeBbl - readings[0].activeBbl;
  return {
    steps: rows,
    netChangeBbl: round(net, 1),
    flagged: rows.filter((row) => row.overThreshold).length,
  };
}
