/**
 * Lab quality control.
 *
 * The desk trusts the numbers on the sheet completely, so something has to
 * check the sheet. Two hands running the same sample should land inside the
 * repeatability of the test, a property that has not moved at all over eight
 * checks is a copied line rather than a stable mud, and a reading that repeats
 * to two decimal places on a test read off a glass tube did not come off the
 * glass tube.
 */
import { round, mean } from '../util/number.js';
import { REPEATABILITY } from '../mudcheck/pilot.js';
import { series } from './series.js';

/**
 * Two hands on the same sample.
 */
export function duplicate({ property, first, second }) {
  const limit = REPEATABILITY[property];
  if (limit === undefined) {
    throw new Error(`there is no repeatability figure for ${property}`);
  }
  const difference = second - first;
  return {
    property,
    first,
    second,
    difference: round(difference, 3),
    repeatability: limit,
    agrees: Math.abs(difference) <= limit,
  };
}

/**
 * A property that has not moved over a run of checks.
 *
 * A mud weight that reads 12.40 on nine checks in a row is a mud weight
 * somebody stopped measuring.
 */
export function copiedLines(checks, property, { runLength = 6 } = {}) {
  const read = series(checks, property);
  const runs = [];
  let start = 0;
  for (let i = 1; i <= read.points.length; i += 1) {
    const same = i < read.points.length && read.points[i].value === read.points[start].value;
    if (same) {
      continue;
    }
    if (i - start >= runLength) {
      runs.push({
        property,
        value: read.points[start].value,
        from: read.points[start].date,
        to: read.points[i - 1].date,
        length: i - start,
      });
    }
    start = i;
  }
  return runs;
}

/**
 * A reading recorded to more precision than the test can give.
 */
export const PRECISION = {
  weightPpg: 2,
  funnelSeconds: 0,
  ph: 1,
  filtrateApiMl: 1,
  sandPercent: 2,
  chlorideMgL: 0,
};

export function tooPrecise({ property, value }) {
  const places = PRECISION[property];
  if (places === undefined) {
    return { property, value, tooPrecise: false, allowedPlaces: null };
  }
  const text = String(value);
  const decimals = text.includes('.') ? text.split('.')[1].length : 0;
  return {
    property,
    value,
    allowedPlaces: places,
    tooPrecise: decimals > places,
  };
}

/**
 * Everything the lab check finds over a run.
 */
export function labReview(checks, { runLength = 6 } = {}) {
  const copied = [];
  const precise = [];
  for (const property of Object.keys(PRECISION)) {
    copied.push(...copiedLines(checks, property, { runLength }));
    const read = series(checks, property);
    for (const point of read.points) {
      const judged = tooPrecise({ property, value: point.value });
      if (judged.tooPrecise) {
        precise.push({ ...judged, date: point.date });
      }
    }
  }
  return {
    copiedRuns: copied,
    overPrecise: precise,
    clean: copied.length === 0 && precise.length === 0,
  };
}

/**
 * How much the readings scatter, which is the other half of the picture.
 */
export function scatter(checks, property) {
  const read = series(checks, property);
  if (read.points.length < 3) {
    return null;
  }
  const values = read.points.map((point) => point.value);
  const middle = mean(values, property);
  const spread = Math.sqrt(
    values.reduce((total, value) => total + (value - middle) ** 2, 0) / (values.length - 1)
  );
  return {
    property,
    readings: values.length,
    mean: round(middle, 3),
    standardDeviation: round(spread, 4),
    // The sum of squares of identical values is not exactly zero in floating
    // point, so a flat property is judged against a tolerance rather than zero.
    suspiciouslyFlat: spread < 1e-9,
  };
}
