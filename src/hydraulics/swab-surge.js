/**
 * Swab and surge.
 *
 * Pipe moving in the hole pushes mud ahead of it and drags a layer along with
 * it. Going in, the pressure at the shoe rises and the formation can break
 * down. Coming out, it falls and the well can be swabbed in. Both are worked
 * from an effective annular velocity that stands in for the pipe movement,
 * and then through the ordinary annular pressure loss.
 *
 * The clinging constant is the layer of mud the pipe drags with it. Nought
 * four five is the usual figure for laminar flow in a concentric annulus.
 */
import { toPositive, toNonNegative, toNumber, round } from '../util/number.js';
import { annularLoss } from './pressure-loss.js';
import { GRADIENT_PER_PPG } from '../units/density.js';

/** The share of the pipe speed the mud next to it is dragged along at. */
export const CLINGING_CONSTANT = 0.45;

/**
 * Effective annular velocity for a pipe moving at a given speed, feet a minute.
 */
export function effectiveVelocity({
  pipeSpeedFeetPerMinute,
  holeIdInches,
  pipeOdInches,
  closedEnd = false,
  clingingConstant = CLINGING_CONSTANT,
}) {
  const speed = toNonNegative(pipeSpeedFeetPerMinute, 'pipeSpeedFeetPerMinute');
  const hole = toPositive(holeIdInches, 'holeIdInches');
  const pipe = toPositive(pipeOdInches, 'pipeOdInches');
  if (pipe >= hole) {
    throw new Error(`a ${pipe} inch pipe does not fit in a ${hole} inch hole`);
  }
  const cling = toNonNegative(clingingConstant, 'clingingConstant');
  const ratio = (pipe * pipe) / (hole * hole - pipe * pipe);
  const displaced = closedEnd ? ratio : 0;
  return (cling + displaced) * speed;
}

/**
 * Average pipe speed over a stand, feet a minute.
 */
export function pipeSpeed({ standLengthFeet, secondsPerStand }) {
  const length = toPositive(standLengthFeet, 'standLengthFeet');
  const seconds = toPositive(secondsPerStand, 'secondsPerStand');
  return (length * 60) / seconds;
}

/**
 * Pressure change at the bottom of the hole from a trip, in psi.
 *
 * The sign follows the trip: going in is a surge and comes back positive,
 * coming out is a swab and comes back negative.
 */
export function tripPressure({
  rows,
  pipeSpeedFeetPerMinute,
  densityPpg,
  model,
  direction = 'in',
  closedEnd = false,
  clingingConstant = CLINGING_CONSTANT,
}) {
  if (direction !== 'in' && direction !== 'out') {
    throw new Error(`a trip goes in or out, not ${direction}`);
  }
  let total = 0;
  const sections = rows.map((row) => {
    const velocity = effectiveVelocity({
      pipeSpeedFeetPerMinute,
      holeIdInches: row.idInches,
      pipeOdInches: row.odInches,
      closedEnd,
      clingingConstant,
    });
    // The loss routine wants a flow rate, so the effective velocity is turned
    // back into the rate that would produce it in this length.
    const flowGpm = (velocity * (row.idInches ** 2 - row.odInches ** 2)) / 24.5;
    const loss = annularLoss({
      flowGpm,
      holeIdInches: row.idInches,
      pipeOdInches: row.odInches,
      lengthFeet: row.lengthFeet,
      densityPpg,
      model,
    });
    total += loss.psi;
    return { holeName: row.holeName, pipeName: row.pipeName, ...loss };
  });
  const signed = direction === 'in' ? total : -total;
  return {
    direction,
    pipeSpeedFeetPerMinute: round(pipeSpeedFeetPerMinute, 1),
    pressurePsi: round(signed, 1),
    sections,
  };
}

/**
 * The equivalent mud weight the trip puts on the formation.
 */
export function tripEquivalentWeight({ weightPpg, pressurePsi, tvdFeet }) {
  const weight = toPositive(weightPpg, 'weightPpg');
  const pressure = toNumber(pressurePsi, 'pressurePsi');
  const depth = toPositive(tvdFeet, 'tvdFeet');
  return round(weight + pressure / (GRADIENT_PER_PPG * depth), 2);
}

/**
 * The fastest the pipe can be moved and stay inside the window.
 *
 * Walks the speed up until the limit is passed and then bisects, the same way
 * the rate solver does, because the loss is not linear in speed.
 */
export function safeTripSpeed({
  rows,
  densityPpg,
  model,
  tvdFeet,
  weightPpg,
  limitPpg,
  direction = 'in',
  closedEnd = false,
}) {
  const weightAt = (speed) =>
    tripEquivalentWeight({
      weightPpg,
      pressurePsi: tripPressure({
        rows,
        pipeSpeedFeetPerMinute: speed,
        densityPpg,
        model,
        direction,
        closedEnd,
      }).pressurePsi,
      tvdFeet,
    });
  const past = (speed) =>
    direction === 'in' ? weightAt(speed) > limitPpg : weightAt(speed) < limitPpg;
  let low = 0;
  let high = 600;
  if (past(1)) {
    return { feetPerMinute: 0, equivalentWeightPpg: weightAt(0), limited: 'at any speed' };
  }
  if (!past(high)) {
    return { feetPerMinute: high, equivalentWeightPpg: weightAt(high), limited: null };
  }
  for (let step = 0; step < 30; step += 1) {
    const middle = (low + high) / 2;
    if (past(middle)) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return {
    feetPerMinute: round(low, 0),
    equivalentWeightPpg: weightAt(low),
    limited: null,
  };
}
