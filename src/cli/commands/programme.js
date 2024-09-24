/**
 * The programme command: read a mud programme and either print it, plan a
 * section off it, or judge a run of checks against it.
 */
import { readProgramme } from '../../program/window.js';
import { sectionPlan } from '../../program/section.js';
import {
  exceptionReport,
  byProperty,
  programmeSuspects,
  unusedWindows,
} from '../../quality/exceptions.js';
import { readChecks } from '../../mudcheck/record.js';
import { readProduct } from '../../inventory/stock.js';
import { heading, rule, listPhrase } from '../../util/text.js';
import { definitionList, table } from '../../util/table.js';

/**
 * Print the programme as it stands.
 */
export function renderProgramme(programme) {
  const lines = [heading(`mud programme  ${programme.well}`), rule(70)];
  for (const section of programme.sections) {
    lines.push(
      '',
      heading(section.name),
      ...definitionList([
        ['from', `${section.fromFeet} ft`],
        ['to', `${section.toFeet} ft`],
        ['hole size', section.holeSizeInches === null ? '' : `${section.holeSizeInches} in`],
      ]),
      table(
        [
          { key: 'property', heading: 'property' },
          { key: 'min', heading: 'min', align: 'right' },
          { key: 'max', heading: 'max', align: 'right' },
        ],
        Object.entries(section.limits).map(([property, window]) => ({
          property,
          min: window.min,
          max: window.max,
        }))
      )
    );
  }
  const unused = unusedWindows(programme);
  if (unused.length > 0) {
    lines.push('', `no window anywhere on ${listPhrase(unused)}`);
  }
  return lines;
}

/**
 * Judge a run of checks against the programme.
 */
export function renderCompliance(programme, rawChecks) {
  const checks = readChecks(rawChecks);
  const report = exceptionReport(checks, programme);
  const properties = byProperty(report);
  const suspects = programmeSuspects(report);
  const lines = [
    heading(`programme compliance  ${programme.well}`),
    rule(70),
    ...definitionList([
      ['checks judged', report.judged],
      ['checks outside', report.outside],
      ['share outside', report.outsideShare],
    ]),
  ];
  if (properties.length > 0) {
    lines.push(
      '',
      heading('by property'),
      table(
        [
          { key: 'label', heading: 'property' },
          { key: 'times', heading: 'times', align: 'right' },
          { key: 'above', heading: 'above', align: 'right' },
          { key: 'below', heading: 'below', align: 'right' },
          { key: 'worst', heading: 'worst', decimals: 3, align: 'right' },
        ],
        properties
      )
    );
  }
  if (suspects.length > 0) {
    lines.push('', heading('windows worth revisiting'));
    for (const suspect of suspects) {
      lines.push(`  ${suspect.label}: ${suspect.reason}`);
    }
  }
  return { report, properties, suspects, lines };
}

export function programmeCommand({ programme, checks = null, plan = null }) {
  const read = readProgramme(programme);
  if (checks) {
    const compliance = renderCompliance(read, checks);
    return { data: compliance.report, lines: compliance.lines };
  }
  if (plan) {
    const section = read.sections.find((row) => row.name === plan.section);
    if (!section) {
      throw new Error(`there is no section called ${plan.section} in the programme`);
    }
    const data = sectionPlan({
      section,
      treatments: plan.treatments,
      products: plan.products.map((row, index) => readProduct(row, `products[${index}]`)),
      surfaceSystemBbl: plan.surfaceSystemBbl,
    });
    return {
      data,
      lines: [
        heading(`section plan  ${data.name}`),
        rule(60),
        ...definitionList([
          ['from', `${data.fromFeet} ft`],
          ['to', `${data.toFeet} ft`],
          ['hole volume', `${data.holeVolumeBbl} bbl`],
          ['surface system', `${data.surfaceSystemBbl} bbl`],
          ['dilution', `${data.dilutionBbl} bbl`],
          ['lost on cuttings', `${data.lostOnCuttingsBbl} bbl`],
          ['total to build', `${data.totalToBuildBbl} bbl`],
        ]),
        '',
        heading('products'),
        table(
          [
            { key: 'name', heading: 'product' },
            { key: 'quantity', heading: 'qty', align: 'right' },
            { key: 'unit', heading: 'unit' },
            { key: 'value', heading: 'value', decimals: 2, align: 'right' },
          ],
          data.products
        ),
        '',
        ...definitionList([
          ['product cost', data.productCost],
          ['cost per foot', data.costPerFoot],
        ]),
      ],
    };
  }
  return { data: read, lines: renderProgramme(read) };
}
