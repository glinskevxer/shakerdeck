/**
 * Pulling a property out of a run of checks so it can be charted or trended.
 *
 * The awkward part is that the checks are not all the same shape. A check
 * taken while tripping has a weight and nothing else, and a series that
 * silently drops those reads as though the property were steady over a gap it
 * never measured. Every series here carries the gaps with it.
 */
import { round } from '../util/number.js';
import { rheologyOf } from '../mudcheck/derive.js';

/**
 * Where each chartable property is read from on a check.
 */
export const READERS = {
  weightPpg: (check) => check.weightPpg,
  funnelSeconds: (check) => check.funnelSeconds,
  ph: (check) => check.ph,
  chlorideMgL: (check) => check.chlorideMgL,
  sandPercent: (check) => check.sandPercent,
  mbtLbBbl: (check) => check.mbtLbBbl,
  filtrateApiMl: (check) => check.filtrate?.apiMl ?? null,
  plasticViscosity: (check) => rheologyOf(check)?.plasticViscosity ?? null,
  yieldPoint: (check) => rheologyOf(check)?.yieldPoint ?? null,
  solidsPercent: (check) => check.retort?.solidsPercent ?? null,
};

/**
 * Read one property across a run of checks.
 */
export function series(checks, property) {
  const reader = READERS[property];
  if (!reader) {
    throw new Error(`there is nothing on a check called ${property}`);
  }
  const points = [];
  let missing = 0;
  for (const check of checks) {
    const value = reader(check);
    if (value === null || value === undefined) {
      missing += 1;
      continue;
    }
    points.push({ date: check.date, depthFeet: check.depthFeet, value });
  }
  return {
    property,
    points,
    taken: points.length,
    missing,
    coverage: checks.length === 0 ? 0 : round(points.length / checks.length, 3),
  };
}

/**
 * Every property that was measured often enough to be worth charting.
 */
export function chartable(checks, { minimumPoints = 5 } = {}) {
  return Object.keys(READERS)
    .map((property) => series(checks, property))
    .filter((row) => row.taken >= minimumPoints)
    .map((row) => row.property);
}

/**
 * How a property moved over the run.
 */
export function movement(checks, property) {
  const read = series(checks, property);
  if (read.points.length < 2) {
    return { property, movement: null, reason: 'not enough readings' };
  }
  const first = read.points[0];
  const last = read.points.at(-1);
  const values = read.points.map((point) => point.value);
  return {
    property,
    from: first.value,
    to: last.value,
    changed: round(last.value - first.value, 4),
    lowest: Math.min(...values),
    highest: Math.max(...values),
    spread: round(Math.max(...values) - Math.min(...values), 4),
    overFeet: round(last.depthFeet - first.depthFeet, 1),
    reason: null,
  };
}

/**
 * Every property that moved, biggest mover first, as a share of its own
 * spread. A weight that moved a pound and a chloride that moved a thousand
 * cannot be ranked against each other any other way.
 */
export function biggestMovers(checks) {
  return Object.keys(READERS)
    .map((property) => movement(checks, property))
    .filter((row) => row.reason === null && row.spread > 0)
    .map((row) => ({ ...row, share: round(Math.abs(row.changed) / row.spread, 3) }))
    .sort((a, b) => b.share - a.share);
}
