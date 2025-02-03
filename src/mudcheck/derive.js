/**
 * Everything that follows from a check, worked out once.
 *
 * Five places were each deciding for themselves whether a check had enough on
 * it to work the rheology and the solids out, and they had drifted: two of
 * them passed the methylene blue figure into the solids split and two did not,
 * so the drilled solids on the daily report and the drilled solids in the
 * export were different numbers off the same check.
 */
import { binghamSummary } from '../rheology/bingham.js';
import { solidsSummary } from '../solids/analysis.js';

/**
 * The Bingham block, or nothing when the dials were not read.
 */
export function rheologyOf(check) {
  return check?.dials ? binghamSummary(check.dials) : null;
}

/**
 * The solids block, or nothing when the retort was not run.
 *
 * The clay figure goes in wherever there is one, so the drilled solids come
 * out the same everywhere they are printed.
 */
export function solidsOf(check) {
  if (!check?.retort) {
    return null;
  }
  return solidsSummary({
    weightPpg: check.weightPpg,
    solidsPercent: check.retort.solidsPercent,
    waterPercent: check.retort.waterPercent,
    oilPercent: check.retort.oilPercent,
    bentoniteLbBbl: check.mbtLbBbl ?? 0,
  });
}

/**
 * The water fraction of the mud, for anything that has to put a filtrate
 * figure back over the water it came from.
 */
export function waterFractionOf(check) {
  return check?.retort ? check.retort.waterPercent / 100 : 1;
}

/**
 * Both blocks and the water fraction together.
 */
export function derive(check) {
  return {
    rheology: rheologyOf(check),
    solids: solidsOf(check),
    waterFraction: waterFractionOf(check),
  };
}

/**
 * The readings a programme window can judge, flattened off a check.
 */
export function judgeableReadings(check) {
  const rheology = rheologyOf(check);
  return {
    weightPpg: check.weightPpg,
    funnelSeconds: check.funnelSeconds,
    plasticViscosity: rheology?.plasticViscosity ?? null,
    yieldPoint: rheology?.yieldPoint ?? null,
    filtrateApiMl: check.filtrate?.apiMl ?? null,
    ph: check.ph,
    chlorideMgL: check.chlorideMgL,
    solidsPercent: check.retort?.solidsPercent ?? null,
    mbtLbBbl: check.mbtLbBbl,
    sandPercent: check.sandPercent,
  };
}
