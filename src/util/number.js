/**
 * Numeric helpers shared by every calculation in the codebase.
 *
 * Field readings arrive as decimal strings from tally sheets and from the rig
 * data feed, so parsing is strict on purpose. A blank cell is not zero, and a
 * value that fails to parse must not silently become NaN halfway through a
 * material balance.
 */

const NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

export class ValueError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValueError';
    this.field = field;
  }
}

/**
 * Parse a reading that must be a finite number.
 */
export function toNumber(value, field = 'value') {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ValueError(`${field} is not a finite number`, field);
    }
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      throw new ValueError(`${field} is blank`, field);
    }
    if (!NUMERIC.test(trimmed)) {
      throw new ValueError(`${field} is not a number: ${value}`, field);
    }
    return Number(trimmed);
  }
  throw new ValueError(`${field} is not a number`, field);
}

/**
 * Parse a reading that must be finite and at least zero.
 */
export function toNonNegative(value, field = 'value') {
  const n = toNumber(value, field);
  if (n < 0) {
    throw new ValueError(`${field} must not be negative, got ${n}`, field);
  }
  return n;
}

/**
 * Parse a reading that must be finite and above zero.
 */
export function toPositive(value, field = 'value') {
  const n = toNumber(value, field);
  if (n <= 0) {
    throw new ValueError(`${field} must be above zero, got ${n}`, field);
  }
  return n;
}

/**
 * Parse a whole count, rejecting fractions outright rather than truncating.
 */
export function toCount(value, field = 'count') {
  const n = toNumber(value, field);
  if (!Number.isInteger(n)) {
    throw new ValueError(`${field} must be a whole number, got ${n}`, field);
  }
  if (n < 0) {
    throw new ValueError(`${field} must not be negative, got ${n}`, field);
  }
  return n;
}

/**
 * Round half away from zero at a fixed number of decimals.
 *
 * Javascript's toFixed rounds half to even in some engines and half up in
 * others once binary representation gets involved, and mud reports are read
 * against a printed number, so the rule is pinned here.
 */
export function round(value, decimals = 2) {
  const n = toNumber(value, 'value');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 12) {
    throw new ValueError(`decimals must be a whole number from 0 to 12`, 'decimals');
  }
  const factor = 10 ** decimals;
  const scaled = n * factor;
  const nudged = scaled + (scaled >= 0 ? 1e-9 : -1e-9);
  const rounded = scaled >= 0 ? Math.floor(nudged + 0.5) : Math.ceil(nudged - 0.5);
  return rounded / factor;
}

/**
 * Clamp into an inclusive range.
 */
export function clamp(value, low, high) {
  const n = toNumber(value, 'value');
  const lo = toNumber(low, 'low');
  const hi = toNumber(high, 'high');
  if (lo > hi) {
    throw new ValueError('low must not exceed high', 'low');
  }
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Sum a list of readings.
 */
export function sum(values, field = 'values') {
  if (!Array.isArray(values)) {
    throw new ValueError(`${field} must be a list`, field);
  }
  let total = 0;
  for (let i = 0; i < values.length; i += 1) {
    total += toNumber(values[i], `${field}[${i}]`);
  }
  return total;
}

/**
 * Arithmetic mean, undefined on an empty list rather than zero.
 */
export function mean(values, field = 'values') {
  if (!Array.isArray(values) || values.length === 0) {
    throw new ValueError(`${field} must hold at least one reading`, field);
  }
  return sum(values, field) / values.length;
}

/**
 * True when two readings agree to within a tolerance.
 */
export function near(a, b, tolerance = 1e-9) {
  return (
    Math.abs(toNumber(a, 'a') - toNumber(b, 'b')) <= Math.abs(toNumber(tolerance, 'tolerance'))
  );
}

/**
 * Divide, naming the divisor in the error rather than returning Infinity.
 */
export function divide(numerator, denominator, field = 'denominator') {
  const d = toNumber(denominator, field);
  if (d === 0) {
    throw new ValueError(`${field} is zero`, field);
  }
  return toNumber(numerator, 'numerator') / d;
}

/**
 * Linear interpolation between two points, extrapolating past the ends.
 */
export function interpolate(x, x0, y0, x1, y1) {
  const span = toNumber(x1, 'x1') - toNumber(x0, 'x0');
  if (span === 0) {
    throw new ValueError('x0 and x1 are the same point', 'x1');
  }
  const t = (toNumber(x, 'x') - toNumber(x0, 'x0')) / span;
  return toNumber(y0, 'y0') + t * (toNumber(y1, 'y1') - toNumber(y0, 'y0'));
}
