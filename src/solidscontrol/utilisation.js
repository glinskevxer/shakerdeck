/**
 * What the solids control equipment actually ran for.
 *
 * A centrifuge that is on the rental sheet for thirty days and ran for nine is
 * a centrifuge nobody was watching. The removal figures on the daily report
 * assume the equipment was running, so the hours have to be recorded beside
 * them or the whole solids picture is a plan rather than a measurement.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/**
 * One piece of equipment over a period.
 */
export function utilisation({ name, hoursRun, hoursAvailable, downtime = [] }) {
  const run = toNonNegative(hoursRun, `${name} hoursRun`);
  const available = toPositive(hoursAvailable, `${name} hoursAvailable`);
  if (run > available) {
    throw new Error(`${name} ran for ${run} hours out of ${available}`);
  }
  const lost = downtime.reduce(
    (total, entry, index) => total + toNonNegative(entry.hours, `${name} downtime ${index + 1}`),
    0
  );
  return {
    name,
    hoursRun: round(run, 1),
    hoursAvailable: round(available, 1),
    hoursIdle: round(available - run, 1),
    hoursDown: round(lost, 1),
    utilisation: round(run / available, 3),
    downtime: downtime.map((entry) => ({
      reason: entry.reason ?? 'not recorded',
      hours: round(toNonNegative(entry.hours, 'hours'), 1),
    })),
  };
}

/**
 * The whole spread, worst utilisation first.
 */
export function spreadUtilisation(equipment) {
  return equipment.map((item) => utilisation(item)).sort((a, b) => a.utilisation - b.utilisation);
}

/**
 * Why the equipment was down, over the whole spread.
 */
export function downtimeReasons(rows) {
  const totals = new Map();
  for (const row of rows) {
    for (const entry of row.downtime) {
      totals.set(entry.reason, (totals.get(entry.reason) ?? 0) + entry.hours);
    }
  }
  const total = [...totals.values()].reduce((sum, hours) => sum + hours, 0);
  if (total === 0) {
    return [];
  }
  return [...totals.entries()]
    .map(([reason, hours]) => ({
      reason,
      hours: round(hours, 1),
      share: round(hours / total, 3),
    }))
    .sort((a, b) => b.hours - a.hours);
}

/**
 * What the removal figure on the report is really worth, once the hours are
 * taken into account.
 *
 * A spread rated at seventy percent removal that ran half the time removed
 * thirty five percent, and the mud does not care what the rating was.
 */
export function effectiveRemoval({ ratedShare, rows }) {
  const rated = toNonNegative(ratedShare, 'ratedShare');
  if (rows.length === 0) {
    throw new Error('there is no equipment to average over');
  }
  const running = rows.reduce((total, row) => total + row.utilisation, 0) / rows.length;
  return {
    ratedShare: round(rated, 3),
    averageUtilisation: round(running, 3),
    effectiveShare: round(rated * running, 3),
    lostShare: round(rated * (1 - running), 3),
  };
}

/**
 * What the idle hours cost at the rental rate.
 */
export function idleCost({ rows, ratesPerDay }) {
  return rows
    .map((row) => {
      const rate = toNonNegative(ratesPerDay[row.name] ?? 0, `${row.name} rate`);
      const idleDays = row.hoursIdle / 24;
      return {
        name: row.name,
        idleDays: round(idleDays, 2),
        ratePerDay: rate,
        cost: round(idleDays * rate, 2),
      };
    })
    .sort((a, b) => b.cost - a.cost);
}
