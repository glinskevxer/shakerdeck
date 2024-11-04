/**
 * Dates, and reading them off a sheet.
 *
 * Every date on this desk is a calendar day written yyyy-mm-dd, because that
 * is what goes on a tour sheet and because it sorts. Nothing here reads the
 * system clock unless it is asked to, and the one function that can is given
 * the clock as an argument so a test can hold it still.
 */
import { toNumber } from './number.js';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Read a calendar day, refusing anything that is not one.
 */
export function readDay(text, field = 'date') {
  if (typeof text !== 'string' || !DATE.test(text.trim())) {
    throw new Error(`${field} must be a date as yyyy-mm-dd, found ${text}`);
  }
  const [, year, month, day] = text.trim().match(DATE);
  const stamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const back = new Date(stamp);
  if (
    back.getUTCFullYear() !== Number(year) ||
    back.getUTCMonth() !== Number(month) - 1 ||
    back.getUTCDate() !== Number(day)
  ) {
    throw new Error(`${field} is not a real date: ${text}`);
  }
  return { text: text.trim(), stamp };
}

/**
 * Days between two calendar days, which is always a whole number.
 */
export function daysBetween(from, to) {
  const start = readDay(from, 'from');
  const end = readDay(to, 'to');
  return Math.round((end.stamp - start.stamp) / 86400000);
}

/**
 * A day a number of days on from another.
 */
export function addDays(day, count) {
  const start = readDay(day, 'day');
  const moved = new Date(start.stamp + toNumber(count, 'count') * 86400000);
  return moved.toISOString().slice(0, 10);
}

/**
 * Every day from one to another, inclusive.
 */
export function daysFrom(from, to) {
  const span = daysBetween(from, to);
  if (span < 0) {
    throw new Error(`${to} is before ${from}`);
  }
  const days = [];
  for (let i = 0; i <= span; i += 1) {
    days.push(addDays(from, i));
  }
  return days;
}

/**
 * Sort a list of records by their date, oldest first, without touching the
 * list that was passed in.
 */
export function byDay(records, key = 'date') {
  return [...records].sort((a, b) => {
    const left = readDay(a[key], key).stamp;
    const right = readDay(b[key], key).stamp;
    return left - right;
  });
}

/**
 * The day a clock is showing. The clock is an argument so nothing here ever
 * depends on when the tests happen to run.
 */
export function today(clock = () => new Date()) {
  return clock().toISOString().slice(0, 10);
}

/**
 * Split a run of days into the ones that are missing from a set of records.
 *
 * A daily report with a hole in it is a report that is wrong rather than a
 * report that is short, and nothing else on the desk notices.
 */
export function missingDays(records, { from, to, key = 'date' } = {}) {
  const present = new Set(records.map((record) => readDay(record[key], key).text));
  const first = from ?? [...present].sort()[0];
  const last = to ?? [...present].sort().at(-1);
  if (!first || !last) {
    return [];
  }
  return daysFrom(first, last).filter((day) => !present.has(day));
}
