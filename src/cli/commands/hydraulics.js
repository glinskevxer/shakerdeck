/**
 * The hydraulics command: read a well and a mud check, and print the whole
 * circulating picture on one page.
 */
import { wellVolumes } from '../../well/geometry.js';
import { pumpOutput, circulationTimes, describePump } from '../../well/pump.js';
import { systemPressure } from '../../hydraulics/system.js';
import { annularProfile, slowestAnnulus } from '../../hydraulics/velocity.js';
import { densityWindow } from '../../hydraulics/ecd.js';
import { holeCleaning } from '../../hydraulics/cuttings.js';
import { annularModel } from '../../rheology/powerlaw.js';
import { readDials } from '../../rheology/dial.js';
import { readCheck } from '../../mudcheck/record.js';
import { heading, rule } from '../../util/text.js';
import { definitionList, table } from '../../util/table.js';
import { round } from '../../util/number.js';

/**
 * Work the whole circulating system out for one well at one rate.
 */
export function readHydraulics(well, check) {
  const read = readCheck(check, 'check');
  if (!read.dials) {
    throw new Error('the hydraulics need a full set of dial readings');
  }
  const dials = readDials(check.dials);
  const volumes = wellVolumes({ hole: well.hole, string: well.string });
  const perStroke = pumpOutput(well.pump);
  const flowGpm = well.flowGpm;
  const weightPpg = well.weightPpg ?? read.weightPpg;
  const system = systemPressure({
    flowGpm,
    densityPpg: weightPpg,
    dials,
    stringSections: volumes.stringSections,
    annulusRows: volumes.annulus.map((row) => ({
      idInches: row.idInches,
      odInches: row.odInches,
      lengthFeet: row.lengthFeet,
      holeName: row.holeName,
      pipeName: row.pipeName,
    })),
    nozzleThirtySeconds: well.nozzleThirtySeconds,
    bitDiameterInches: well.bitDiameterInches,
    surfaceCase: well.surfaceCase ?? 3,
  });
  const annulus = volumes.annulus.map((row) => ({
    holeName: row.holeName,
    pipeName: row.pipeName,
    idInches: row.idInches,
    odInches: row.odInches,
    lengthFeet: row.lengthFeet,
  }));
  const slowest = slowestAnnulus(annulus, flowGpm);
  const window = densityWindow({
    weightPpg,
    annularLossPsi: system.annulusPsi,
    tvdFeet: well.tvdFeet ?? well.totalDepthFeet,
    porePressurePpg: well.porePressurePpg,
    fractureGradientPpg: well.fractureGradientPpg,
    cuttings: well.penetrationFeetPerHour
      ? {
          penetrationFeetPerHour: well.penetrationFeetPerHour,
          bitDiameterInches: well.bitDiameterInches,
          flowGpm,
        }
      : null,
  });
  const cleaning = holeCleaning({
    model: annularModel(dials),
    annularVelocityFeetPerMinute: slowest.velocityFeetPerMinute,
    holeIdInches:
      slowest.idInches ?? annulus.find((row) => row.holeName === slowest.holeName).idInches,
    pipeOdInches: annulus.find((row) => row.pipeName === slowest.pipeName).odInches,
    mudWeightPpg: weightPpg,
    penetrationFeetPerHour: well.penetrationFeetPerHour ?? 0,
    bitDiameterInches: well.bitDiameterInches,
    flowGpm,
  });
  return {
    well: well.well,
    depthFeet: well.totalDepthFeet,
    flowGpm,
    pump: describePump(well.pump, well.strokesPerMinute ?? 0),
    volumes: {
      annulusBbl: volumes.annulusBbl,
      stringBbl: volumes.stringBbl,
      holeVolumeBbl: volumes.holeVolumeBbl,
    },
    circulation: circulationTimes({
      stringBbl: volumes.stringBbl,
      annulusBbl: volumes.annulusBbl,
      bblPerStroke: perStroke,
      strokesPerMinute: well.strokesPerMinute ?? 1,
    }),
    pressure: system,
    velocities: annularProfile(annulus, flowGpm),
    slowest,
    window,
    cleaning,
  };
}

/**
 * Lay the hydraulics out as a page.
 */
export function renderHydraulics(data) {
  return [
    heading(`hydraulics  ${data.well}`),
    rule(70),
    ...definitionList([
      ['depth', `${data.depthFeet} ft`],
      ['rate', `${data.flowGpm} gpm`],
      ['pump', `${data.pump.label} at ${data.pump.bblPerStroke} bbl/stk`],
    ]),
    '',
    heading('pressure'),
    ...definitionList([
      ['surface equipment', data.pressure.surfacePsi],
      ['drill string', data.pressure.stringPsi],
      ['bit', data.pressure.bitPsi],
      ['annulus', data.pressure.annulusPsi],
      ['standpipe', data.pressure.standpipePsi],
      ['bit share', data.pressure.bitShare],
    ]),
    '',
    heading('annular velocity'),
    table(
      [
        { key: 'holeName', heading: 'hole' },
        { key: 'pipeName', heading: 'pipe' },
        { key: 'lengthFeet', heading: 'feet', align: 'right' },
        { key: 'velocityFeetPerMinute', heading: 'ft/min', decimals: 1, align: 'right' },
      ],
      data.velocities
    ),
    '',
    heading('density window'),
    ...definitionList([
      ['pore pressure', data.window.porePressurePpg],
      ['mud weight', data.window.weightPpg],
      ['circulating', data.window.ecdPpg],
      ['fracture', data.window.fractureGradientPpg],
      ['overbalance', data.window.overbalancePpg],
      ['margin to fracture', data.window.marginPpg],
    ]),
    '',
    heading('hole cleaning'),
    ...definitionList([
      [
        'slowest annulus',
        `${data.slowest.velocityFeetPerMinute} ft/min in the ${data.slowest.holeName}`,
      ],
      ['slip velocity', `${data.cleaning.slipVelocityFeetPerMinute} ft/min`],
      ['transport ratio', data.cleaning.transportRatio],
      ['cuttings in the annulus', data.cleaning.cuttingsConcentrationPercent],
      ['verdict', data.cleaning.cleaning ? 'cleaning' : 'not cleaning'],
    ]),
    '',
    `bottoms up ${data.circulation.bottomsUpStrokes} strokes, ${round(data.circulation.bottomsUpMinutes, 0)} minutes`,
  ];
}

export function hydraulicsCommand(well, check) {
  const data = readHydraulics(well, check);
  return { data, lines: renderHydraulics(data) };
}
