/**
 * The solids command: what the whole spread took out, and what it saved.
 *
 * The shakers, the cones and the centrifuge are worked as a train because that
 * is how they run. Each one only ever sees what the one before it left, and
 * adding their catalogue removal figures up is how a spread that removes forty
 * percent gets sold as one that removes ninety.
 */
import { screenPerformance } from '../../solidscontrol/screens.js';
import { trainPerformance } from '../../solidscontrol/hydrocyclone.js';
import { centrifugeRun } from '../../solidscontrol/centrifuge.js';
import { solidsGenerated, dilutionAgainstRemoval } from '../../material/dilution.js';
import { round } from '../../util/number.js';
import { heading, rule } from '../../util/text.js';
import { definitionList, table } from '../../util/table.js';

/**
 * Run the whole spread over a day's cuttings.
 */
export function readSolidsControl(spread) {
  const made = solidsGenerated({
    bitDiameterInches: spread.bitDiameterInches,
    footageFeet: spread.footageFeet,
    washoutFraction: spread.washoutFraction ?? 0,
  });
  let remaining = made.barrels;
  let sizes = spread.distribution;
  const stages = [];
  for (const shaker of spread.shakers ?? []) {
    const result = screenPerformance({
      apiNumber: shaker.apiNumber,
      distribution: sizes,
      solidsBbl: remaining,
    });
    stages.push({
      stage: `shaker api ${shaker.apiNumber}`,
      feedBbl: round(remaining, 2),
      removedBbl: result.removedBbl,
      passedBbl: result.passedBbl,
      cutMicrons: result.cutMicrons,
    });
    remaining = result.passedBbl;
    sizes = result.passedDistribution;
  }
  if (spread.cones && spread.cones.length > 0) {
    const train = trainPerformance({
      stages: spread.cones.map((cone) => ({ ...cone, flowGpm: spread.flowGpm })),
      distribution: sizes,
      solidsBbl: remaining,
    });
    for (const stage of train.stages) {
      stages.push({
        stage: stage.type,
        feedBbl: stage.feedBbl,
        removedBbl: stage.removedBbl,
        passedBbl: stage.passedBbl,
        cutMicrons: stage.cutMicrons,
        fullyProcessing: stage.fullyProcessing,
      });
    }
    remaining = train.passedBbl;
  }
  const centrifuge = spread.centrifuge
    ? centrifugeRun({ ...spread.centrifuge, mudPpg: spread.mudPpg })
    : null;
  const removed = made.barrels - remaining;
  const efficiency = made.barrels === 0 ? 0 : removed / made.barrels;
  return {
    well: spread.well,
    solidsMadeBbl: made.barrels,
    stages,
    removedBbl: round(removed, 2),
    passedBbl: round(remaining, 2),
    removalEfficiency: round(efficiency, 3),
    centrifuge,
    comparison: dilutionAgainstRemoval({
      solidsBbl: made.barrels,
      targetFraction: spread.targetSolidsFraction ?? 0.05,
      removalEfficiency: efficiency,
      mudCostPerBbl: spread.mudCostPerBbl ?? 0,
      removalCostPerBbl: spread.removalCostPerBbl ?? 0,
    }),
  };
}

/**
 * Lay the spread out as a page.
 */
export function renderSolidsControl(data) {
  const lines = [
    heading(`solids control  ${data.well}`),
    rule(70),
    ...definitionList([
      ['solids made', `${data.solidsMadeBbl} bbl`],
      ['removed', `${data.removedBbl} bbl`],
      ['left in the mud', `${data.passedBbl} bbl`],
      ['removal efficiency', data.removalEfficiency],
    ]),
    '',
    heading('the train'),
    table(
      [
        { key: 'stage', heading: 'stage' },
        { key: 'cutMicrons', heading: 'cut', decimals: 1, align: 'right' },
        { key: 'feedBbl', heading: 'fed', decimals: 2, align: 'right' },
        { key: 'removedBbl', heading: 'took', decimals: 2, align: 'right' },
        { key: 'passedBbl', heading: 'passed', decimals: 2, align: 'right' },
      ],
      data.stages
    ),
  ];
  if (data.centrifuge) {
    lines.push(
      '',
      heading('centrifuge'),
      ...definitionList([
        ['feed', `${data.centrifuge.feedGpm} gpm at ${data.centrifuge.feedPpg} ppg`],
        ['underflow', `${data.centrifuge.underflowGpm} gpm`],
        ['barite recovered', `${data.centrifuge.bariteRecoveredPounds} lb`],
        ['solids discarded', `${data.centrifuge.solidsDiscardedPounds} lb`],
        ['liquid discarded', `${data.centrifuge.liquidDiscardedBbl} bbl`],
      ])
    );
  }
  lines.push(
    '',
    heading('against dilution alone'),
    ...definitionList([
      ['dilution with no removal', `${data.comparison.dilutionOnlyBbl} bbl`],
      ['dilution as run', `${data.comparison.withRemovalBbl} bbl`],
      ['saved', data.comparison.savedCost],
    ])
  );
  return lines;
}

export function solidsCommand(spread) {
  const data = readSolidsControl(spread);
  return { data, lines: renderSolidsControl(data) };
}
