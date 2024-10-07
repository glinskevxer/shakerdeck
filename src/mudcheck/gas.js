/**
 * Gas in the returns.
 *
 * Three readings that look alike and mean very different things. Background
 * gas is what the formation gives up as it is drilled. Connection gas is what
 * comes in while the pumps are off and the annulus loses its friction. Trip
 * gas is what has fed in over the whole time the string was out. The first is
 * information, the second is a warning and the third is a measurement of how
 * underbalanced the well has been.
 *
 * Gas cut mud is the reading that frightens people the most and matters the
 * least. A pound of cut at the flowline costs single figures of psi at the
 * bottom of the hole, because the gas that expands to cut the mud at surface
 * was a thimbleful down there.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { GRADIENT_PER_PPG } from '../units/density.js';

/** Atmospheric pressure at the flowline, psi. */
export const ATMOSPHERIC_PSI = 14.7;

/**
 * The pressure a gas cut column actually loses at the bottom of the hole.
 */
export function gasCutPressureLoss({ uncutPpg, cutPpg, tvdFeet }) {
  const uncut = toPositive(uncutPpg, 'uncutPpg');
  const cut = toPositive(cutPpg, 'cutPpg');
  const depth = toPositive(tvdFeet, 'tvdFeet');
  if (cut > uncut) {
    throw new Error(`a cut of ${cut} is heavier than the ${uncut} it was cut from`);
  }
  if (cut === uncut) {
    return { lossPsi: 0, equivalentPpg: 0 };
  }
  const bottom = GRADIENT_PER_PPG * uncut * depth;
  const loss = ((uncut - cut) / cut) * ATMOSPHERIC_PSI * Math.log(bottom / ATMOSPHERIC_PSI);
  return {
    lossPsi: round(loss, 1),
    equivalentPpg: round(loss / (GRADIENT_PER_PPG * depth), 3),
  };
}

/**
 * The naive figure, which is the one somebody always quotes on the radio.
 */
export function naiveGasCutLoss({ uncutPpg, cutPpg, tvdFeet }) {
  const uncut = toPositive(uncutPpg, 'uncutPpg');
  const cut = toPositive(cutPpg, 'cutPpg');
  return round(GRADIENT_PER_PPG * (uncut - cut) * toPositive(tvdFeet, 'tvdFeet'), 0);
}

/**
 * What a gas reading is, from where in the tour it was taken.
 */
export function classifyGas({ units, backgroundUnits, kind }) {
  const reading = toNonNegative(units, 'units');
  const background = toNonNegative(backgroundUnits, 'backgroundUnits');
  const overBackground = reading - background;
  const ratio = background === 0 ? null : round(reading / background, 2);
  let level = 'normal';
  if (kind === 'connection' || kind === 'trip') {
    if (overBackground > background * 3) {
      level = 'significant';
    } else if (overBackground > background) {
      level = 'worth watching';
    }
  } else if (background > 0 && reading > background * 5) {
    level = 'significant';
  } else if (background > 0 && reading > background * 2) {
    level = 'worth watching';
  }
  return {
    kind,
    units: reading,
    backgroundUnits: background,
    overBackground: round(overBackground, 1),
    ratio,
    level,
  };
}

/**
 * Trip gas as an overbalance measurement.
 *
 * Trip gas that climbs from one trip to the next on the same section means the
 * overbalance is falling, whatever the mud weight on the report says.
 */
export function tripGasTrend(trips) {
  if (!Array.isArray(trips) || trips.length < 2) {
    throw new Error('a trip gas trend needs at least two trips');
  }
  const rows = trips.map((trip, index) => ({
    date: trip.date,
    depthFeet: toPositive(trip.depthFeet, `trip ${index + 1} depthFeet`),
    units: toNonNegative(trip.units, `trip ${index + 1} units`),
    weightPpg: toPositive(trip.weightPpg, `trip ${index + 1} weightPpg`),
  }));
  const first = rows[0];
  const last = rows.at(-1);
  const climbing = last.units > first.units;
  const heavier = last.weightPpg > first.weightPpg;
  let verdict = 'steady';
  if (climbing && !heavier) {
    verdict = 'gas up on the same weight, the overbalance is falling';
  } else if (climbing && heavier) {
    verdict = 'gas up despite a heavier mud, look at the section';
  } else if (!climbing && heavier) {
    verdict = 'the weight up worked';
  }
  return {
    trips: rows,
    fromUnits: first.units,
    toUnits: last.units,
    changedUnits: round(last.units - first.units, 1),
    weightChangedPpg: round(last.weightPpg - first.weightPpg, 2),
    verdict,
  };
}
