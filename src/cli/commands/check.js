/**
 * The check command: read a mud check and print what it says.
 */
import { readCheck } from '../../mudcheck/record.js';
import { binghamSummary, gels } from '../../rheology/bingham.js';
import { alkalinitySummary } from '../../mudcheck/alkalinity.js';
import { chemistrySummary } from '../../mudcheck/titration.js';
import { claySummary } from '../../mudcheck/clay.js';
import { solidsSummary } from '../../solids/analysis.js';
import { describeDensity } from '../../units/density.js';
import { definitionList, table } from '../../util/table.js';
import { heading, rule } from '../../util/text.js';

/**
 * Work everything the sheet supports out of one check.
 */
export function readCheckSheet(record) {
  const check = readCheck(record);
  const water = check.retort ? check.retort.waterPercent / 100 : 1;
  const solids = check.retort
    ? solidsSummary({
        weightPpg: check.weightPpg,
        solidsPercent: check.retort.solidsPercent,
        waterPercent: check.retort.waterPercent,
        oilPercent: check.retort.oilPercent,
        bentoniteLbBbl: check.mbtLbBbl ?? 0,
      })
    : null;
  return {
    well: check.well,
    date: check.date,
    depthFeet: check.depthFeet,
    samplePoint: check.samplePoint,
    base: check.base,
    density: describeDensity(check.weightPpg),
    funnelSeconds: check.funnelSeconds,
    temperatureF: check.temperatureF,
    ph: check.ph,
    rheology: check.dials ? binghamSummary(check.dials) : null,
    gels: check.gels ? gels(check.gels) : null,
    filtrate: check.filtrate,
    alkalinity: alkalinitySummary(check.alkalinity, water),
    chemistry: chemistrySummary({
      chlorideMgL: check.chlorideMgL,
      totalHardnessMgL: check.totalHardnessMgL,
    }),
    clay: claySummary({
      mbtLbBbl: check.mbtLbBbl,
      sandPercent: check.sandPercent,
      lowGravityLbBbl: solids?.lowGravityLbBbl,
      solidsLbBbl: solids ? solids.bariteLbBbl + solids.lowGravityLbBbl : null,
    }),
    solids,
    note: check.note,
  };
}

function block(title, pairs) {
  const rows = pairs.filter(([, value]) => value !== null && value !== undefined);
  if (rows.length === 0) {
    return [];
  }
  return ['', heading(title), ...definitionList(rows)];
}

/**
 * Lay the check out as a page.
 */
export function renderCheck(data) {
  const lines = [
    heading(`mud check  ${data.well}`),
    rule(60),
    ...definitionList([
      ['date', data.date],
      ['depth', `${data.depthFeet} ft`],
      ['sample', data.samplePoint],
      ['base', data.base],
    ]),
    ...block('density', [
      ['weight', `${data.density.ppg} ppg`],
      ['gravity', data.density.sg],
      ['gradient', `${data.density.gradientPsiPerFoot} psi/ft`],
      ['funnel', data.funnelSeconds === null ? null : `${data.funnelSeconds} s`],
      ['temperature', data.temperatureF === null ? null : `${data.temperatureF} F`],
    ]),
  ];
  if (data.rheology) {
    lines.push(
      '',
      heading('rheology'),
      ...definitionList([
        ['plastic viscosity', `${data.rheology.plasticViscosity} cP`],
        ['yield point', `${data.rheology.yieldPoint} lb/100ft2`],
        ['apparent viscosity', `${data.rheology.apparentViscosity} cP`],
        ['yp over pv', data.rheology.ypPvRatio],
      ])
    );
  }
  if (data.gels) {
    lines.push(
      '',
      heading('gels'),
      ...definitionList([
        ['ten second', data.gels.tenSecond],
        ['ten minute', data.gels.tenMinute],
        ['thirty minute', data.gels.thirtyMinute],
        ['progressive', data.gels.progressive ? 'yes' : 'no'],
      ])
    );
  }
  if (data.solids) {
    lines.push(
      '',
      heading('solids'),
      table(
        [
          { key: 'part', heading: 'part' },
          { key: 'percent', heading: 'vol %', decimals: 2, align: 'right' },
          { key: 'lbBbl', heading: 'lb/bbl', decimals: 1, align: 'right' },
        ],
        [
          {
            part: 'high gravity',
            percent: data.solids.highGravityPercent,
            lbBbl: data.solids.bariteLbBbl,
          },
          {
            part: 'low gravity',
            percent: data.solids.lowGravityPercent,
            lbBbl: data.solids.lowGravityLbBbl,
          },
          {
            part: 'drilled',
            percent: data.solids.drilledPercent,
            lbBbl: data.solids.drilledLbBbl,
          },
        ]
      )
    );
  }
  if (data.alkalinity) {
    lines.push(
      '',
      heading('alkalinity'),
      ...definitionList([
        ['pf / mf', `${data.alkalinity.pf} / ${data.alkalinity.mf}`],
        ['carbonate', `${data.alkalinity.carbonateMgL} mg/l`],
        ['bicarbonate', `${data.alkalinity.bicarbonateMgL} mg/l`],
        ['excess lime', data.alkalinity.excessLimeLbBbl],
        ['verdict', data.alkalinity.carbonateLevel],
      ])
    );
  }
  if (data.chemistry) {
    lines.push(
      '',
      heading('chemistry'),
      ...definitionList([
        ['chloride', `${data.chemistry.chlorideMgL} mg/l`],
        ['salt by weight', `${data.chemistry.saltPercentByWeight} %`],
        ['hardness', data.chemistry.hardness],
      ])
    );
  }
  if (data.note) {
    lines.push('', heading('note'), data.note);
  }
  return lines;
}

export function checkCommand(record) {
  const data = readCheckSheet(record);
  return { data, lines: renderCheck(data) };
}
