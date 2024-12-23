/**
 * The pits command: total the active system over a tour and read the changes.
 */
import { activeVolume, pitTrend } from '../../pits/totalizer.js';
import { heading, rule } from '../../util/text.js';
import { definitionList, table } from '../../util/table.js';

/**
 * Total each reading and run the trend across them.
 */
export function readPits({ well, tanks, readings, thresholdBbl = 10 }) {
  if (!Array.isArray(readings) || readings.length === 0) {
    throw new Error('there are no pit readings to total');
  }
  const totals = readings.map((reading) => {
    const totalled = activeVolume(tanks, reading.levels);
    return { time: reading.time, activeBbl: totalled.activeBbl, tanks: totalled.tanks };
  });
  return {
    well,
    readings: totals,
    trend: totals.length > 1 ? pitTrend(totals, { thresholdBbl }) : null,
    latest: totals.at(-1),
  };
}

/**
 * Lay the pit report out.
 */
export function renderPits(data) {
  const lines = [
    heading(`pit report  ${data.well}`),
    rule(70),
    table(
      [
        { key: 'time', heading: 'time' },
        { key: 'activeBbl', heading: 'active bbl', decimals: 1, align: 'right' },
      ],
      data.readings
    ),
    '',
    heading(`tanks at ${data.latest.time}`),
    table(
      [
        { key: 'name', heading: 'tank' },
        { key: 'shape', heading: 'shape' },
        { key: 'levelFeet', heading: 'level', decimals: 2, align: 'right' },
        { key: 'volumeBbl', heading: 'bbl', decimals: 1, align: 'right' },
        { key: 'barrelsPerFoot', heading: 'bbl/ft', decimals: 2, align: 'right' },
        { key: 'active', heading: 'lined up' },
      ],
      data.latest.tanks
    ),
  ];
  if (data.trend) {
    lines.push(
      '',
      heading('changes'),
      table(
        [
          { key: 'from', heading: 'from' },
          { key: 'to', heading: 'to' },
          { key: 'changeBbl', heading: 'change', decimals: 1, align: 'right' },
          { key: 'verdict', heading: 'verdict' },
        ],
        data.trend.steps
      ),
      '',
      ...definitionList([
        ['net over the tour', data.trend.netChangeBbl],
        ['steps flagged', data.trend.flagged],
      ])
    );
  }
  return lines;
}

export function pitsCommand(input) {
  const data = readPits(input);
  return { data, lines: renderPits(data) };
}
