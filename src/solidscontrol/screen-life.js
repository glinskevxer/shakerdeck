/**
 * How long a shaker screen lasts, and what it costs when it does not.
 *
 * A screen is cheap and changing one is not: the shaker comes off line, the
 * mud that was going over it goes somewhere else, and on a rig with two
 * shakers the second one is suddenly seeing all of the returns. A screen that
 * lasts nine hours instead of thirty is a solids control problem long before
 * it is a purchasing one.
 */
import { toPositive, toNonNegative, round, mean } from '../util/number.js';

/**
 * Life of one screen, from when it went on to when it came off.
 */
export function screenLife({ api, onHours, offHours, reason = 'worn' }) {
  const on = toNonNegative(onHours, 'onHours');
  const off = toPositive(offHours, 'offHours');
  if (off <= on) {
    throw new Error(`a screen cannot come off at ${off} hours after going on at ${on}`);
  }
  return { api, hours: round(off - on, 1), reason };
}

/**
 * The life a run of screens gave, by designation.
 */
export function lifeByScreen(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    throw new Error('there are no screen runs to read');
  }
  const grouped = new Map();
  for (const run of runs) {
    const life = screenLife(run);
    const rows = grouped.get(life.api) ?? [];
    rows.push(life);
    grouped.set(life.api, rows);
  }
  return [...grouped.entries()]
    .map(([api, rows]) => ({
      api,
      screens: rows.length,
      averageHours: round(
        mean(
          rows.map((row) => row.hours),
          'hours'
        ),
        1
      ),
      shortestHours: Math.min(...rows.map((row) => row.hours)),
      torn: rows.filter((row) => row.reason === 'torn').length,
    }))
    .sort((a, b) => a.averageHours - b.averageHours);
}

/**
 * What the screens cost over a period, and what the shaker being off line did.
 */
export function screenCost({ runs, pricePerScreen, changeMinutes = 20, rigRatePerHour = 0 }) {
  const rows = runs.map((run) => screenLife(run));
  const price = toNonNegative(pricePerScreen, 'pricePerScreen');
  const change = toNonNegative(changeMinutes, 'changeMinutes');
  const rate = toNonNegative(rigRatePerHour, 'rigRatePerHour');
  const offLineHours = (rows.length * change) / 60;
  return {
    screens: rows.length,
    screenCost: round(rows.length * price, 2),
    offLineHours: round(offLineHours, 2),
    offLineCost: round(offLineHours * rate, 2),
    totalCost: round(rows.length * price + offLineHours * rate, 2),
  };
}

/**
 * Whether a screen life is what the cloth should give.
 *
 * The expectation is a rule of thumb rather than a specification, which is why
 * it is a range: a fine screen in a soft formation is doing well to last a day
 * and a coarse one on a clean hole will run a week.
 */
export const EXPECTED_HOURS = { coarse: 96, medium: 48, fine: 24 };

export function screenVerdict({ api, hours }) {
  const band = api <= 80 ? 'coarse' : api <= 170 ? 'medium' : 'fine';
  const expected = EXPECTED_HOURS[band];
  const share = hours / expected;
  let level = 'as expected';
  if (share < 0.4) {
    level = 'far short';
  } else if (share < 0.75) {
    level = 'short';
  } else if (share > 1.5) {
    level = 'better than expected';
  }
  return { api, band, hours, expectedHours: expected, share: round(share, 2), level };
}

/**
 * A run of screens judged against what they should have given.
 */
export function screenReview(runs) {
  const rows = runs.map((run) => {
    const life = screenLife(run);
    return { ...screenVerdict({ api: life.api, hours: life.hours }), reason: life.reason };
  });
  const short = rows.filter((row) => row.level === 'short' || row.level === 'far short');
  return {
    screens: rows,
    shortLived: short.length,
    tornShare: round(rows.filter((row) => row.reason === 'torn').length / rows.length, 3),
    // A run of torn screens is a shaker problem: a bad seal, a worn deck, or a
    // flow rate the basket cannot take. A run of worn screens is a solids
    // problem. They look the same on a purchase order.
    likelyShaker: rows.filter((row) => row.reason === 'torn').length > rows.length / 2,
  };
}
