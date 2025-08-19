/**
 * The crew change handover.
 *
 * Two weeks of context handed over in ten minutes on a helideck. What it has
 * to carry is not the numbers, which are all on the reports, but the things
 * that are only in one person's head: what is drifting, what has been treated
 * and has not responded yet, what is nearly out of stock, and what somebody
 * said they would do and has not done.
 */
import { round } from '../util/number.js';
import { listPhrase } from '../util/text.js';
import { title, firstBlock, listBlock } from './blocks.js';
import { biggestMovers } from '../quality/series.js';
import { chart } from '../quality/control.js';
import { exceptionReport, byProperty } from '../quality/exceptions.js';

/**
 * Build the handover off the last stretch of the well.
 */
export function buildHandover({
  well,
  outgoing,
  incoming,
  date,
  checks,
  programme = null,
  stock = [],
  openItems = [],
  treatments = [],
}) {
  if (checks.length < 2) {
    throw new Error('a handover needs at least two checks to say what is moving');
  }
  const weights = checks.map((check) => check.weightPpg);
  const control = weights.length >= 3 ? chart('weightPpg', weights) : null;
  const exceptions = programme ? exceptionReport(checks, programme) : null;
  return {
    well,
    outgoing,
    incoming,
    date,
    over: { from: checks[0].date, to: checks.at(-1).date, checks: checks.length },
    depthFeet: checks.at(-1).depthFeet,
    weightPpg: checks.at(-1).weightPpg,
    movers: biggestMovers(checks).slice(0, 3),
    weightInControl: control === null ? null : control.inControl,
    outOn: exceptions ? byProperty(exceptions).map((row) => row.label) : [],
    short: stock.filter((line) => line.short),
    treatmentsPending: treatments.filter((treatment) => !treatment.responded),
    openItems,
  };
}

/**
 * The lines under the what is moving heading, which is the block that carries
 * the reason the handover exists.
 */
function movingLines(data) {
  const lines =
    data.movers.length === 0
      ? ['nothing moved worth mentioning']
      : data.movers.map(
          (mover) =>
            `${mover.property}: ${mover.from} to ${mover.to} over ${round(mover.overFeet, 0)} ft`
        );
  if (data.weightInControl === false) {
    lines.push('the mud weight chart is out of control, look at the last few checks');
  }
  return lines;
}

/**
 * Lay it out for the helideck.
 */
export function renderHandover(data) {
  const lines = [
    ...title(`handover  ${data.well}`),
    ...firstBlock([
      ['date', data.date],
      ['from', data.outgoing],
      ['to', data.incoming],
      ['covering', `${data.over.from} to ${data.over.to}, ${data.over.checks} checks`],
      ['depth', `${data.depthFeet} ft`],
      ['weight', `${data.weightPpg} ppg`],
    ]),
  ];
  lines.push(...listBlock('what is moving', movingLines(data)));

  if (data.outOn.length > 0) {
    lines.push(...listBlock('outside the programme', [listPhrase(data.outOn)]));
  }
  lines.push(
    ...listBlock(
      'treated and not answered yet',
      data.treatmentsPending.map((treatment) => `${treatment.date}: ${treatment.what}`)
    )
  );
  if (data.short.length > 0) {
    lines.push(
      ...listBlock('short', [
        listPhrase(data.short.map((line) => `${line.name} (${line.daysOfCover} days)`)),
      ])
    );
  }
  lines.push(...listBlock('open', data.openItems));
  return lines;
}

/**
 * The one thing that must not be forgotten, if there is one.
 */
export function firstThing(data) {
  if (data.short.length > 0) {
    return `order ${data.short[0].name}, ${data.short[0].daysOfCover} days of cover left`;
  }
  if (data.treatmentsPending.length > 0) {
    return `watch the ${data.treatmentsPending[0].what}, it has not answered yet`;
  }
  if (data.weightInControl === false) {
    return 'the mud weight chart is out of control';
  }
  if (data.outOn.length > 0) {
    return `the mud is outside the programme on ${listPhrase(data.outOn)}`;
  }
  return 'nothing outstanding';
}
