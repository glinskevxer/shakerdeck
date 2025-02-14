/**
 * The trip command: run a trip sheet and say where the drift started.
 */
import { runTripSheet, driftOnset } from '../../well/tripsheet.js';
import { heading, rule } from '../../util/text.js';
import { definitionList, table } from '../../util/table.js';

export function readTrip(input) {
  const sheet = runTripSheet(input);
  return { well: input.well, ...sheet, drift: driftOnset(sheet) };
}

export function renderTrip(data) {
  const lines = [
    heading(`trip sheet  ${data.well}`),
    rule(70),
    ...definitionList([
      ['direction', data.direction],
      ['per stand', `${data.perStandBbl} bbl`],
      ['stands', data.stands.length],
      ['expected', `${data.expectedBbl} bbl`],
      ['actual', `${data.actualBbl} bbl`],
      ['difference', `${data.differenceBbl} bbl`],
    ]),
    '',
    heading('stand by stand'),
    table(
      [
        { key: 'stand', heading: 'stand', decimals: 0, align: 'right' },
        { key: 'depthFeet', heading: 'depth', decimals: 0, align: 'right' },
        { key: 'movedBbl', heading: 'moved', decimals: 2, align: 'right' },
        { key: 'expectedBbl', heading: 'should', decimals: 2, align: 'right' },
        { key: 'differenceBbl', heading: 'running', decimals: 2, align: 'right' },
        { key: 'overThreshold', heading: 'flagged' },
      ],
      data.stands
    ),
    '',
    heading('verdict'),
    `  ${data.verdict}`,
  ];
  if (data.drift) {
    lines.push(
      '',
      ...definitionList([
        ['drift first crossed at stand', data.drift.stand],
        ['depth', `${data.drift.depthFeet} ft`],
        ['worst single stand', `${data.drift.worstSingleStandBbl} bbl`],
      ]),
      '  no single stand was far out, which is why the running total is the one to read'
    );
  }
  return lines;
}

export function tripCommand(input) {
  const data = readTrip(input);
  return { data, lines: renderTrip(data) };
}
