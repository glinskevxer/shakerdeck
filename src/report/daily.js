/**
 * The daily mud report.
 *
 * One page, the same shape every day, because the company man reads thirty of
 * them over a well and any change in the layout costs him time. The order is
 * the one the API form uses: who and where, then the mud, then the solids,
 * then what was done to it, then what it cost.
 */
import { round } from '../util/number.js';
import { heading, rule, listPhrase } from '../util/text.js';
import { definitionList, table } from '../util/table.js';
import { readCheck } from '../mudcheck/record.js';
import { binghamSummary } from '../rheology/bingham.js';
import { solidsSummary } from '../solids/analysis.js';
import { checkAgainstWindow, sectionAt } from '../program/window.js';

const PAGE_WIDTH = 74;

/**
 * Gather everything the page needs from the day's records.
 */
export function buildDaily({
  well,
  date,
  reportNumber,
  check,
  programme = null,
  activity = [],
  products = [],
  costs = null,
  pits = null,
  circulation = null,
}) {
  const read = readCheck(check, 'check');
  const rheology = read.dials ? binghamSummary(read.dials) : null;
  const solids = read.retort
    ? solidsSummary({
        weightPpg: read.weightPpg,
        solidsPercent: read.retort.solidsPercent,
        waterPercent: read.retort.waterPercent,
        oilPercent: read.retort.oilPercent,
        bentoniteLbBbl: read.mbtLbBbl ?? 0,
      })
    : null;
  let compliance = null;
  if (programme) {
    const section = sectionAt(programme, read.depthFeet);
    compliance = section
      ? checkAgainstWindow(
          {
            weightPpg: read.weightPpg,
            funnelSeconds: read.funnelSeconds,
            plasticViscosity: rheology?.plasticViscosity ?? null,
            yieldPoint: rheology?.yieldPoint ?? null,
            filtrateApiMl: read.filtrate?.apiMl ?? null,
            ph: read.ph,
            chlorideMgL: read.chlorideMgL,
            solidsPercent: read.retort?.solidsPercent ?? null,
            mbtLbBbl: read.mbtLbBbl,
            sandPercent: read.sandPercent,
          },
          section
        )
      : { section: null, exceptions: [], inWindow: true };
  }
  return {
    well,
    date,
    reportNumber,
    check: read,
    rheology,
    solids,
    compliance,
    activity,
    products,
    costs,
    pits,
    circulation,
  };
}

function header(data) {
  return [
    heading(`daily mud report  ${data.well}`),
    rule(PAGE_WIDTH),
    ...definitionList([
      ['report', data.reportNumber ?? ''],
      ['date', data.date],
      ['depth', `${data.check.depthFeet} ft`],
      ['base', data.check.base],
      ['sample', data.check.samplePoint],
    ]),
  ];
}

function properties(data) {
  const rows = [
    ['weight', `${data.check.weightPpg} ppg`],
    ['funnel', data.check.funnelSeconds === null ? null : `${data.check.funnelSeconds} s`],
    ['temperature', data.check.temperatureF === null ? null : `${data.check.temperatureF} F`],
    ['ph', data.check.ph],
    ['api filtrate', data.check.filtrate?.apiMl ?? null],
    ['cake', data.check.filtrate?.cakeThirtySecondInch ?? null],
    ['chloride', data.check.chlorideMgL],
    ['sand', data.check.sandPercent],
  ];
  if (data.rheology) {
    rows.splice(
      2,
      0,
      ['plastic viscosity', `${data.rheology.plasticViscosity} cP`],
      ['yield point', `${data.rheology.yieldPoint} lb/100ft2`]
    );
  }
  return [
    '',
    heading('mud properties'),
    ...definitionList(rows.filter(([, value]) => value !== null && value !== undefined)),
  ];
}

function solidsBlock(data) {
  if (!data.solids) {
    return [];
  }
  return [
    '',
    heading('solids'),
    ...definitionList([
      ['total', `${data.solids.solidsPercent} %`],
      ['high gravity', `${data.solids.highGravityPercent} % / ${data.solids.bariteLbBbl} lb/bbl`],
      ['low gravity', `${data.solids.lowGravityPercent} % / ${data.solids.lowGravityLbBbl} lb/bbl`],
      ['drilled', `${data.solids.drilledPercent} %`],
      ['average gravity', data.solids.averageSg],
    ]),
  ];
}

function exceptionsBlock(data) {
  if (!data.compliance) {
    return [];
  }
  if (data.compliance.inWindow) {
    return [
      '',
      heading('programme'),
      `every property is inside the ${data.compliance.section} window`,
    ];
  }
  return [
    '',
    heading('programme exceptions'),
    table(
      [
        { key: 'label', heading: 'property' },
        { key: 'value', heading: 'read', align: 'right' },
        { key: 'limit', heading: 'limit', align: 'right' },
        { key: 'side', heading: 'side' },
        { key: 'byHowMuch', heading: 'out by', align: 'right' },
      ],
      data.compliance.exceptions
    ),
  ];
}

function activityBlock(data) {
  if (!data.activity || data.activity.length === 0) {
    return [];
  }
  return ['', heading('activity'), ...data.activity.map((line) => `  ${line}`)];
}

function productsBlock(data) {
  if (!data.products || data.products.length === 0) {
    return [];
  }
  return [
    '',
    heading('products used'),
    table(
      [
        { key: 'name', heading: 'product' },
        { key: 'quantity', heading: 'qty', align: 'right' },
        { key: 'unit', heading: 'unit' },
        { key: 'value', heading: 'value', decimals: 2, align: 'right' },
      ],
      data.products
    ),
  ];
}

function costsBlock(data) {
  if (!data.costs) {
    return [];
  }
  return [
    '',
    heading('cost'),
    ...definitionList([
      ['products', data.costs.productCost],
      ['service', data.costs.serviceCharge],
      ['rental', data.costs.rentalCharge],
      ['haulage', data.costs.haulageCharge],
      ['day total', data.costs.total],
      ['per foot', data.costs.costPerFoot],
    ]),
  ];
}

function volumesBlock(data) {
  const rows = [];
  if (data.pits) {
    rows.push(['active system', `${data.pits.activeBbl} bbl`]);
  }
  if (data.circulation) {
    rows.push(
      ['bottoms up', `${data.circulation.bottomsUpStrokes} stk`],
      ['full circulation', `${data.circulation.fullCirculationMinutes} min`],
      ['hole volume', `${data.circulation.totalSystemBbl} bbl`]
    );
  }
  if (rows.length === 0) {
    return [];
  }
  return ['', heading('volumes'), ...definitionList(rows)];
}

/**
 * Lay the whole page out.
 */
export function renderDaily(data) {
  return [
    ...header(data),
    ...properties(data),
    ...solidsBlock(data),
    ...volumesBlock(data),
    ...exceptionsBlock(data),
    ...activityBlock(data),
    ...productsBlock(data),
    ...costsBlock(data),
  ];
}

/**
 * A one line summary for a well that is being followed from town.
 */
export function dailyLine(data) {
  const out = data.compliance?.exceptions?.map((row) => row.label) ?? [];
  return [
    data.date,
    `${data.check.depthFeet} ft`,
    `${data.check.weightPpg} ppg`,
    data.rheology
      ? `pv ${data.rheology.plasticViscosity} yp ${data.rheology.yieldPoint}`
      : 'no rheology',
    data.solids ? `${round(data.solids.solidsPercent, 1)} % solids` : 'no retort',
    out.length === 0 ? 'in window' : `out on ${listPhrase(out)}`,
  ].join('  |  ');
}
