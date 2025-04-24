/**
 * The morning command: the four lines that go out by email at six.
 */
import { buildMorning, renderMorning, morningSubject } from '../../report/morning.js';
import { readProgramme } from '../../program/window.js';
import { readChecks } from '../../mudcheck/record.js';

/**
 * Take the last two checks off a run and build the report from them.
 */
export function readMorning({ well, checks, programme = null, shortages = [], activity = null }) {
  const read = readChecks(checks);
  if (read.length === 0) {
    throw new Error('a morning report needs at least one check');
  }
  const latest = read.at(-1);
  const previous = read.length > 1 ? read.at(-2) : null;
  return buildMorning({
    well: well ?? latest.well,
    date: latest.date,
    check: checks.find((row) => row.date === latest.date && row.depthFeet === latest.depthFeet),
    previousCheck: previous
      ? checks.find((row) => row.date === previous.date && row.depthFeet === previous.depthFeet)
      : null,
    programme: programme ? readProgramme(programme) : null,
    shortages,
    activity,
  });
}

export function morningCommand(inputs) {
  const data = readMorning(inputs);
  return { data, lines: renderMorning(data), subject: morningSubject(data) };
}
