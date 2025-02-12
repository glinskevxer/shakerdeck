/**
 * The morning report.
 *
 * Four lines that go out by email at six, to people who are not on the rig and
 * will not read a page. Where the well is, what the mud is doing, what is
 * outside the programme and what is going to be needed. Anything that cannot
 * be said in those four lines belongs on the daily report instead.
 */
import { round } from '../util/number.js';
import { listPhrase } from '../util/text.js';
import { readCheck } from '../mudcheck/record.js';
import { derive, judgeableReadings } from '../mudcheck/derive.js';
import { checkAgainstWindow, sectionAt } from '../program/window.js';
import { daysBetween } from '../util/clock.js';

/**
 * Pull the morning report together.
 */
export function buildMorning({
  well,
  date,
  check,
  previousCheck = null,
  programme = null,
  shortages = [],
  activity = null,
}) {
  const read = readCheck(check, 'check');
  const { rheology, solids } = derive(read);
  const previous = previousCheck ? readCheck(previousCheck, 'previousCheck') : null;
  const section = programme ? sectionAt(programme, read.depthFeet) : null;
  const compliance = section ? checkAgainstWindow(judgeableReadings(read), section) : null;
  return {
    well,
    date,
    depthFeet: read.depthFeet,
    madeFeet: previous ? round(read.depthFeet - previous.depthFeet, 0) : null,
    overDays: previous ? daysBetween(previous.date, read.date) : null,
    weightPpg: read.weightPpg,
    weightChangePpg: previous ? round(read.weightPpg - previous.weightPpg, 2) : null,
    plasticViscosity: rheology?.plasticViscosity ?? null,
    yieldPoint: rheology?.yieldPoint ?? null,
    solidsPercent: solids?.solidsPercent ?? null,
    section: section?.name ?? null,
    exceptions: compliance?.exceptions ?? [],
    shortages,
    activity,
  };
}

/**
 * Four lines, and never five.
 */
export function renderMorning(data) {
  const where =
    data.madeFeet === null
      ? `${data.well} at ${data.depthFeet} ft`
      : `${data.well} at ${data.depthFeet} ft, ${data.madeFeet} ft made`;
  const mud = [
    `${data.weightPpg} ppg`,
    data.weightChangePpg === null || data.weightChangePpg === 0
      ? null
      : `${data.weightChangePpg > 0 ? 'up' : 'down'} ${Math.abs(data.weightChangePpg)}`,
    data.plasticViscosity === null ? null : `pv ${data.plasticViscosity}`,
    data.yieldPoint === null ? null : `yp ${data.yieldPoint}`,
    data.solidsPercent === null ? null : `${data.solidsPercent} percent solids`,
  ]
    .filter(Boolean)
    .join(', ');
  const programme =
    data.section === null
      ? 'no programme on file'
      : data.exceptions.length === 0
        ? `inside the ${data.section} window`
        : `outside the ${data.section} window on ${listPhrase(data.exceptions.map((row) => row.label))}`;
  const needed =
    data.shortages.length === 0
      ? 'nothing short'
      : `short of ${listPhrase(data.shortages.map((row) => (typeof row === 'string' ? row : row.name)))}`;
  return [
    `${data.date}  ${where}`,
    `mud: ${mud}`,
    `programme: ${programme}`,
    `stock: ${needed}${data.activity ? `. ${data.activity}` : ''}`,
  ];
}

/**
 * The subject line, which is all most people read.
 */
export function morningSubject(data) {
  const state = data.exceptions.length === 0 ? 'in window' : `${data.exceptions.length} out`;
  return `${data.well} ${data.date}: ${data.depthFeet} ft, ${data.weightPpg} ppg, ${state}`;
}
