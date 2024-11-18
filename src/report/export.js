/**
 * Getting the numbers out.
 *
 * The client's engineering group works in a spreadsheet and the operator's
 * database wants a flat file, so everything the desk holds has a table shape
 * it can be written out in. The column sets are here rather than in the
 * command so a caller using the library gets the same columns the command
 * line writes.
 */
import { writeCsv } from '../util/csv.js';
import { binghamSummary } from '../rheology/bingham.js';
import { solidsSummary } from '../solids/analysis.js';

/**
 * One row per mud check, with everything worked out.
 */
export const CHECK_COLUMNS = [
  { key: 'date', heading: 'date' },
  { key: 'well', heading: 'well' },
  { key: 'depthFeet', heading: 'depth_ft', decimals: 0 },
  { key: 'samplePoint', heading: 'sample' },
  { key: 'weightPpg', heading: 'weight_ppg', decimals: 2 },
  { key: 'funnelSeconds', heading: 'funnel_s', decimals: 0 },
  { key: 'temperatureF', heading: 'temperature_f', decimals: 0 },
  { key: 'plasticViscosity', heading: 'pv_cp', decimals: 1 },
  { key: 'yieldPoint', heading: 'yp_lb100ft2', decimals: 1 },
  { key: 'filtrateApiMl', heading: 'api_filtrate_ml', decimals: 1 },
  { key: 'ph', heading: 'ph', decimals: 1 },
  { key: 'chlorideMgL', heading: 'chloride_mgl', decimals: 0 },
  { key: 'solidsPercent', heading: 'solids_pct', decimals: 2 },
  { key: 'drilledPercent', heading: 'drilled_solids_pct', decimals: 2 },
  { key: 'bariteLbBbl', heading: 'barite_lbbbl', decimals: 1 },
];

/**
 * Flatten a check into the row the columns expect.
 */
export function checkRow(check) {
  const rheology = check.dials ? binghamSummary(check.dials) : null;
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
    date: check.date,
    well: check.well,
    depthFeet: check.depthFeet,
    samplePoint: check.samplePoint,
    weightPpg: check.weightPpg,
    funnelSeconds: check.funnelSeconds,
    temperatureF: check.temperatureF,
    plasticViscosity: rheology?.plasticViscosity ?? null,
    yieldPoint: rheology?.yieldPoint ?? null,
    filtrateApiMl: check.filtrate?.apiMl ?? null,
    ph: check.ph,
    chlorideMgL: check.chlorideMgL,
    solidsPercent: check.retort?.solidsPercent ?? null,
    drilledPercent: solids?.drilledPercent ?? null,
    bariteLbBbl: solids?.bariteLbBbl ?? null,
  };
}

export function exportChecks(checks) {
  return writeCsv(CHECK_COLUMNS, checks.map(checkRow));
}

/**
 * One row per day, for the cost tracking spreadsheet.
 */
export const DAY_COLUMNS = [
  { key: 'date', heading: 'date' },
  { key: 'footageFeet', heading: 'footage_ft', decimals: 0 },
  { key: 'mudBuiltBbl', heading: 'mud_built_bbl', decimals: 1 },
  { key: 'productCost', heading: 'product_cost', decimals: 2 },
  { key: 'serviceCharge', heading: 'service', decimals: 2 },
  { key: 'rentalCharge', heading: 'rental', decimals: 2 },
  { key: 'haulageCharge', heading: 'haulage', decimals: 2 },
  { key: 'total', heading: 'day_total', decimals: 2 },
  { key: 'costPerFoot', heading: 'cost_per_ft', decimals: 2 },
];

export function exportDays(days) {
  return writeCsv(DAY_COLUMNS, days);
}

/**
 * One row per product, for the stock reconciliation.
 */
export const STOCK_COLUMNS = [
  { key: 'code', heading: 'code' },
  { key: 'name', heading: 'product' },
  { key: 'unit', heading: 'unit' },
  { key: 'openingQuantity', heading: 'opening', decimals: 2 },
  { key: 'closingQuantity', heading: 'closing', decimals: 2 },
];

export function exportStock(closing) {
  return writeCsv(STOCK_COLUMNS, closing);
}

/**
 * One row per length of annulus, for a hydraulics sheet.
 */
export const ANNULUS_COLUMNS = [
  { key: 'holeName', heading: 'hole' },
  { key: 'pipeName', heading: 'pipe' },
  { key: 'idInches', heading: 'hole_id_in', decimals: 3 },
  { key: 'odInches', heading: 'pipe_od_in', decimals: 3 },
  { key: 'lengthFeet', heading: 'length_ft', decimals: 0 },
  { key: 'velocityFeetPerMinute', heading: 'velocity_ftmin', decimals: 1 },
  { key: 'psi', heading: 'loss_psi', decimals: 1 },
];

export function exportAnnulus(rows) {
  return writeCsv(ANNULUS_COLUMNS, rows);
}

/** Everything that can be written out, by name. */
export const EXPORTS = {
  checks: { columns: CHECK_COLUMNS, write: exportChecks },
  days: { columns: DAY_COLUMNS, write: exportDays },
  stock: { columns: STOCK_COLUMNS, write: exportStock },
  annulus: { columns: ANNULUS_COLUMNS, write: exportAnnulus },
};
