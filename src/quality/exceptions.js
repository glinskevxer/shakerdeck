/**
 * The exception report.
 *
 * Every check on the well against the window for the depth it was taken at,
 * collected so the pattern shows. One check outside the window is a mud
 * engineer catching up. The same property outside it on nine checks out of
 * twelve is a programme that does not match the well, and only the collected
 * view says which of the two is happening.
 */
import { round } from '../util/number.js';
import { checkAgainstWindow, sectionAt, WINDOW_PROPERTIES } from '../program/window.js';
import { judgeableReadings } from '../mudcheck/derive.js';

/**
 * Pull the readings a window can judge off one check.
 */
export function judgeable(check) {
  return judgeableReadings(check);
}

/**
 * Run every check against the programme.
 */
export function exceptionReport(checks, programme) {
  const rows = [];
  let judged = 0;
  let outside = 0;
  for (const check of checks) {
    const section = sectionAt(programme, check.depthFeet);
    if (!section) {
      rows.push({
        date: check.date,
        depthFeet: check.depthFeet,
        section: null,
        exceptions: [],
        offProgramme: true,
      });
      continue;
    }
    judged += 1;
    const result = checkAgainstWindow(judgeable(check), section);
    if (!result.inWindow) {
      outside += 1;
    }
    rows.push({
      date: check.date,
      depthFeet: check.depthFeet,
      section: section.name,
      exceptions: result.exceptions,
      offProgramme: false,
    });
  }
  return {
    checks: rows,
    judged,
    outside,
    outsideShare: judged === 0 ? 0 : round(outside / judged, 3),
  };
}

/**
 * Which properties are out, and how often.
 */
export function byProperty(report) {
  const counts = new Map();
  for (const row of report.checks) {
    for (const exception of row.exceptions) {
      const current = counts.get(exception.property) ?? {
        property: exception.property,
        label: exception.label,
        unit: exception.unit,
        times: 0,
        worst: 0,
        above: 0,
        below: 0,
      };
      current.times += 1;
      current.worst = Math.max(current.worst, exception.byHowMuch);
      current[exception.side] += 1;
      counts.set(exception.property, current);
    }
  }
  return [...counts.values()]
    .map((row) => ({
      ...row,
      share: report.judged === 0 ? 0 : round(row.times / report.judged, 3),
    }))
    .sort((a, b) => b.times - a.times);
}

/**
 * Whether a property is out often enough and in one direction enough that the
 * window is the thing that is wrong.
 */
export function programmeSuspects(report, { threshold = 0.5 } = {}) {
  return byProperty(report)
    .filter((row) => row.share >= threshold)
    .filter((row) => row.above === 0 || row.below === 0)
    .map((row) => ({
      property: row.property,
      label: row.label,
      share: row.share,
      side: row.above > 0 ? 'above' : 'below',
      reason: `outside the window on ${row.times} of ${report.judged} checks, always ${
        row.above > 0 ? 'above' : 'below'
      }`,
    }));
}

/**
 * A property the window never touched, which is a window nobody is using.
 */
export function unusedWindows(programme) {
  const used = new Set();
  for (const section of programme.sections) {
    for (const key of Object.keys(section.limits)) {
      used.add(key);
    }
  }
  return Object.keys(WINDOW_PROPERTIES).filter((key) => !used.has(key));
}
