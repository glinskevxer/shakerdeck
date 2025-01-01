/**
 * The kill command: the mud side of a kill sheet on one page.
 */
import { killSheet } from '../../wellcontrol/killsheet.js';
import { weightUp } from '../../material/weightup.js';
import { heading, rule } from '../../util/text.js';
import { definitionList, table } from '../../util/table.js';

/**
 * Work the sheet and the barite to build the kill mud with it.
 */
export function readKill(input) {
  const sheet = killSheet(input);
  const barite =
    sheet.killPpg > sheet.currentPpg && input.systemBbl
      ? weightUp({
          fromPpg: sheet.currentPpg,
          toPpg: sheet.killPpg,
          volumeBbl: input.systemBbl,
          agent: input.agent ?? 'barite',
        })
      : null;
  return { well: input.well, ...sheet, barite };
}

/**
 * Lay the sheet out.
 */
export function renderKill(data) {
  const lines = [
    heading(`kill sheet  ${data.well}`),
    rule(64),
    ...definitionList([
      ['mud weight now', data.currentPpg],
      ['kill mud weight', data.killPpg],
      ['weight up by', data.weightUpPpg],
      ['initial circulating', `${data.initialPsi} psi`],
      ['final circulating', `${data.finalPsi} psi`],
      ['slow pump', `${data.slowPumpPsi} psi`],
    ]),
    '',
    heading('the influx'),
    ...definitionList([
      ['height', `${data.influx.heightFeet} ft`],
      ['gradient', `${data.influx.gradientPsiPerFoot} psi/ft`],
      ['it looks like', data.influx.kind],
    ]),
    '',
    heading('the shoe'),
    ...definitionList([
      [
        'most the annulus will take',
        data.maximumAnnular.alreadyOver
          ? 'the mud is already at the leak off'
          : `${data.maximumAnnular.psi} psi`,
      ],
    ]),
    '',
    heading('step down schedule'),
    table(
      [
        { key: 'strokes', heading: 'strokes', decimals: 0, align: 'right' },
        { key: 'share', heading: 'share', decimals: 2, align: 'right' },
        { key: 'standpipePsi', heading: 'standpipe', decimals: 0, align: 'right' },
      ],
      data.schedule
    ),
  ];
  if (!data.checks.clean) {
    lines.push('', heading('before this sheet is used'));
    for (const note of data.checks.notes) {
      lines.push(`  ${note}`);
    }
  }
  if (data.barite) {
    lines.push(
      '',
      heading('building the kill mud'),
      ...definitionList([
        ['agent', data.barite.agent],
        ['pounds per barrel', data.barite.poundsPerBarrel],
        ['sacks', data.barite.sacks],
        ['volume it adds', `${data.barite.volumeIncreaseBbl} bbl`],
      ])
    );
  }
  return lines;
}

export function killCommand(input) {
  const data = readKill(input);
  return { data, lines: renderKill(data) };
}
