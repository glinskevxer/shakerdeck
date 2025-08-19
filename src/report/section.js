/**
 * The end of section report.
 *
 * Written when the casing is run and while everybody still remembers what
 * happened. It is the document the next well in the field is planned from, so
 * it says what the section actually took rather than what the programme said
 * it would.
 */
import { round, mean } from '../util/number.js';
import { listPhrase } from '../util/text.js';
import { title, block, firstBlock, tableBlock, listBlock } from './blocks.js';
import { series } from '../quality/series.js';
import { exceptionReport, byProperty } from '../quality/exceptions.js';
import { costToDate } from '../cost/daily.js';
import { daysBetween } from '../util/clock.js';

/**
 * Everything that happened over one section.
 */
export function buildSectionReport({
  section,
  checks,
  programme = null,
  days = [],
  planned = null,
}) {
  const inSection = checks.filter(
    (check) => check.depthFeet > section.fromFeet && check.depthFeet <= section.toFeet
  );
  if (inSection.length === 0) {
    throw new Error(`there are no checks between ${section.fromFeet} and ${section.toFeet} feet`);
  }
  const weights = series(inSection, 'weightPpg').points.map((point) => point.value);
  const costs = days.length > 0 ? costToDate(days) : null;
  const exceptions = programme ? exceptionReport(inSection, programme) : null;
  return {
    section: section.name,
    fromFeet: section.fromFeet,
    toFeet: section.toFeet,
    lengthFeet: section.toFeet - section.fromFeet,
    holeSizeInches: section.holeSizeInches ?? null,
    checks: inSection.length,
    days: daysBetween(inSection[0].date, inSection.at(-1).date) + 1,
    weight: {
      start: weights[0],
      end: weights.at(-1),
      highest: Math.max(...weights),
      average: round(mean(weights, 'weights'), 2),
    },
    exceptions,
    worstProperties: exceptions ? byProperty(exceptions).slice(0, 3) : [],
    costs,
    planned,
    againstPlan:
      planned && costs
        ? {
            plannedCost: round(planned.productCost, 2),
            actualCost: costs.totalCost,
            overrun: round(costs.totalCost - planned.productCost, 2),
            plannedPerFoot: planned.costPerFoot,
            actualPerFoot: costs.costPerFoot,
          }
        : null,
  };
}

/**
 * Lay the section report out.
 */
export function renderSectionReport(data) {
  const lines = [
    ...title(`section report  ${data.section}`, 72),
    ...firstBlock([
      ['from', `${data.fromFeet} ft`],
      ['to', `${data.toFeet} ft`],
      ['length', `${data.lengthFeet} ft`],
      ['hole size', data.holeSizeInches === null ? '' : `${data.holeSizeInches} in`],
      ['checks', data.checks],
      ['days', data.days],
    ]),
    ...block('mud weight', [
      ['start', data.weight.start],
      ['end', data.weight.end],
      ['highest', data.weight.highest],
      ['average', data.weight.average],
    ]),
  ];
  if (data.exceptions) {
    lines.push(
      ...block('against the programme', [
        ['checks judged', data.exceptions.judged],
        ['checks outside', data.exceptions.outside],
      ])
    );
    lines.push(
      ...listBlock(
        'worst on',
        data.worstProperties.length === 0
          ? []
          : [listPhrase(data.worstProperties.map((row) => row.label))]
      )
    );
  }
  if (data.againstPlan) {
    lines.push(
      ...tableBlock(
        'against the plan',
        [
          { key: 'name', heading: '' },
          { key: 'planned', heading: 'planned', decimals: 2, align: 'right' },
          { key: 'actual', heading: 'actual', decimals: 2, align: 'right' },
        ],
        [
          {
            name: 'product cost',
            planned: data.againstPlan.plannedCost,
            actual: data.againstPlan.actualCost,
          },
          {
            name: 'per foot',
            planned: data.againstPlan.plannedPerFoot,
            actual: data.againstPlan.actualPerFoot,
          },
        ]
      )
    );
  } else if (data.costs) {
    lines.push(
      ...block('cost', [
        ['total', data.costs.totalCost],
        ['per foot', data.costs.costPerFoot],
      ])
    );
  }
  return lines;
}
