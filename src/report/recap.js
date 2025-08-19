/**
 * The end of well recap.
 *
 * Everything that happened to the mud on one well, on a few pages, written for
 * somebody who was not there. It is the document that gets read when the next
 * well in the same field is being planned, which makes it worth more than the
 * daily reports it is built from and means it has to say what went wrong as
 * well as what the numbers were.
 */
import { round, mean } from '../util/number.js';
import { missingDays, daysBetween } from '../util/clock.js';
import { listPhrase } from '../util/text.js';
import { title, block, firstBlock, tableBlock, listBlock } from './blocks.js';
import { readChecks } from '../mudcheck/record.js';
import { exceptionReport, byProperty, programmeSuspects } from '../quality/exceptions.js';
import { series, biggestMovers } from '../quality/series.js';
import { chart } from '../quality/control.js';
import { costToDate, costByCategory } from '../cost/daily.js';

/**
 * Put the whole well together.
 */
export function buildRecap({ well, checks, programme = null, days = [] }) {
  const read = readChecks(checks);
  if (read.length === 0) {
    throw new Error('a recap needs at least one mud check');
  }
  const first = read[0];
  const last = read.at(-1);
  const exceptions = programme ? exceptionReport(read, programme) : null;
  const costs = days.length > 0 ? costToDate(days) : null;
  const weights = series(read, 'weightPpg').points.map((point) => point.value);
  return {
    well,
    from: first.date,
    to: last.date,
    days: daysBetween(first.date, last.date) + 1,
    checks: read.length,
    fromDepthFeet: first.depthFeet,
    toDepthFeet: last.depthFeet,
    weight: {
      start: first.weightPpg,
      end: last.weightPpg,
      lowest: Math.min(...weights),
      highest: Math.max(...weights),
      average: round(mean(weights, 'weights'), 2),
    },
    control: weights.length >= 3 ? chart('weightPpg', weights) : null,
    movers: biggestMovers(read).slice(0, 5),
    exceptions,
    exceptionsByProperty: exceptions ? byProperty(exceptions) : [],
    suspects: exceptions ? programmeSuspects(exceptions) : [],
    missingCheckDays: missingDays(read),
    costs,
    costSplit: days.length > 0 ? costByCategory(days) : [],
  };
}

/**
 * Lay the recap out.
 */
export function renderRecap(data) {
  const lines = [
    ...title(`well recap  ${data.well}`, 74),
    ...firstBlock([
      ['from', `${data.from} at ${data.fromDepthFeet} ft`],
      ['to', `${data.to} at ${data.toDepthFeet} ft`],
      ['days', data.days],
      ['checks', data.checks],
    ]),
    ...block('mud weight', [
      ['start', data.weight.start],
      ['end', data.weight.end],
      ['lowest', data.weight.lowest],
      ['highest', data.weight.highest],
      ['average', data.weight.average],
      [
        'in control',
        data.control === null ? 'not enough checks' : data.control.inControl ? 'yes' : 'no',
      ],
    ]),
  ];
  if (data.movers.length > 0) {
    lines.push(
      ...tableBlock(
        'what moved',
        [
          { key: 'property', heading: 'property' },
          { key: 'from', heading: 'from', align: 'right' },
          { key: 'to', heading: 'to', align: 'right' },
          { key: 'spread', heading: 'spread', align: 'right' },
        ],
        data.movers
      )
    );
  }
  if (data.exceptions) {
    lines.push(
      ...block('against the programme', [
        ['checks judged', data.exceptions.judged],
        ['checks outside', data.exceptions.outside],
        ['share outside', data.exceptions.outsideShare],
      ])
    );
    lines.push(
      ...tableBlock(
        'by property',
        [
          { key: 'label', heading: 'property' },
          { key: 'times', heading: 'times', align: 'right' },
          { key: 'worst', heading: 'worst', decimals: 3, align: 'right' },
        ],
        data.exceptionsByProperty
      ),
      ...listBlock(
        'windows worth revisiting',
        data.suspects.map((suspect) => `${suspect.label}: ${suspect.reason}`)
      )
    );
  }
  if (data.missingCheckDays.length > 0) {
    lines.push(...listBlock('days with no check', [listPhrase(data.missingCheckDays)]));
  }
  if (data.costs) {
    lines.push(
      ...block('cost', [
        ['total', data.costs.totalCost],
        ['footage', data.costs.totalFootage],
        ['per foot', data.costs.costPerFoot],
        ['per barrel built', data.costs.costPerBarrelBuilt],
      ]),
      ...tableBlock(
        'where it went',
        [
          { key: 'category', heading: 'category' },
          { key: 'value', heading: 'value', decimals: 2, align: 'right' },
          { key: 'share', heading: 'share', decimals: 3, align: 'right' },
        ],
        data.costSplit
      )
    );
  }
  return lines;
}
