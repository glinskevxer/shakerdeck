/**
 * Individuals and moving range charts on a mud property.
 *
 * One check a tour is not enough data for a subgrouped chart, so the property
 * is charted as individuals with the moving range standing in for the spread.
 * The constants below are the standard ones for a subgroup of two.
 *
 * The point of charting a mud property is not to catch a number outside the
 * programme window, which the exception report already does. It is to catch a
 * property that is drifting while every reading is still inside the window.
 */
import { toNumber, round, mean } from '../util/number.js';

/** Individuals chart constant for a moving range of two. */
export const INDIVIDUALS_CONSTANT = 2.66;

/** Moving range chart constant for a subgroup of two. */
export const RANGE_CONSTANT = 3.267;

/**
 * Moving ranges between consecutive readings.
 */
export function movingRanges(values) {
  if (!Array.isArray(values) || values.length < 2) {
    throw new Error('a moving range needs at least two readings');
  }
  const ranges = [];
  for (let i = 1; i < values.length; i += 1) {
    ranges.push(
      Math.abs(toNumber(values[i], `reading ${i + 1}`) - toNumber(values[i - 1], `reading ${i}`))
    );
  }
  return ranges;
}

/**
 * Control limits for a run of readings.
 */
export function controlLimits(values) {
  const ranges = movingRanges(values);
  const centre = mean(values, 'readings');
  const rangeCentre = mean(ranges, 'ranges');
  return {
    centre: round(centre, 4),
    upper: round(centre + INDIVIDUALS_CONSTANT * rangeCentre, 4),
    lower: round(centre - INDIVIDUALS_CONSTANT * rangeCentre, 4),
    rangeCentre: round(rangeCentre, 4),
    rangeUpper: round(RANGE_CONSTANT * rangeCentre, 4),
    readings: values.length,
  };
}

/**
 * Points outside the limits.
 */
export function outOfControl(values, limits = null) {
  const bounds = limits ?? controlLimits(values);
  const rows = [];
  values.forEach((value, index) => {
    const reading = toNumber(value, `reading ${index + 1}`);
    if (reading > bounds.upper) {
      rows.push({ index, value: reading, rule: 'above the upper limit' });
    } else if (reading < bounds.lower) {
      rows.push({ index, value: reading, rule: 'below the lower limit' });
    }
  });
  return rows;
}

/**
 * A run of readings all on the same side of the centre line.
 *
 * This is the one that catches a mud drifting inside its window. Eight in a
 * row above or below the middle is about as likely as a coin landing the same
 * way eight times, which is to say it is not chance.
 */
export function runsOnOneSide(values, limits = null, length = 8) {
  const bounds = limits ?? controlLimits(values);
  const rows = [];
  let side = 0;
  let start = 0;
  values.forEach((value, index) => {
    const reading = toNumber(value, `reading ${index + 1}`);
    const thisSide = reading > bounds.centre ? 1 : reading < bounds.centre ? -1 : 0;
    if (thisSide !== side || thisSide === 0) {
      side = thisSide;
      start = index;
      return;
    }
    if (index - start + 1 === length) {
      rows.push({
        from: start,
        to: index,
        side: side > 0 ? 'above' : 'below',
        rule: `${length} readings in a row ${side > 0 ? 'above' : 'below'} the centre`,
      });
    }
  });
  return rows;
}

/**
 * A steady climb or fall.
 */
export function trends(values, length = 6) {
  const rows = [];
  let direction = 0;
  let start = 0;
  for (let i = 1; i < values.length; i += 1) {
    const previous = toNumber(values[i - 1], `reading ${i}`);
    const current = toNumber(values[i], `reading ${i + 1}`);
    const step = current > previous ? 1 : current < previous ? -1 : 0;
    if (step !== direction || step === 0) {
      direction = step;
      start = i - 1;
      if (step === 0) {
        continue;
      }
    }
    if (i - start + 1 === length) {
      rows.push({
        from: start,
        to: i,
        direction: direction > 0 ? 'climbing' : 'falling',
        rule: `${length} readings ${direction > 0 ? 'climbing' : 'falling'} in a row`,
      });
    }
  }
  return rows;
}

/**
 * The whole chart for one property.
 */
export function chart(property, values) {
  const limits = controlLimits(values);
  const signals = [
    ...outOfControl(values, limits),
    ...runsOnOneSide(values, limits),
    ...trends(values),
  ];
  return {
    property,
    ...limits,
    signals,
    inControl: signals.length === 0,
  };
}
