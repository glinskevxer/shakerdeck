/**
 * Planning a hole section before it is drilled.
 *
 * How much mud has to be built, how much will leave with the cuttings, how
 * much dilution the solids will need and what the whole thing will cost. It is
 * the number the client asks for at the pre spud meeting and it is the number
 * that is worked out on the back of an envelope on most wells.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { boreCapacity, annularCapacity } from '../well/capacity.js';
import { solidsGenerated, dilutionToHold } from '../material/dilution.js';
import { retentionOnCuttings } from '../waste/cuttings.js';

/**
 * Hole volume for a section, at gauge and with washout.
 */
export function sectionHoleVolume({ bitDiameterInches, lengthFeet, washoutFraction = 0 }) {
  const capacity = boreCapacity(bitDiameterInches);
  const length = toNonNegative(lengthFeet, 'lengthFeet');
  const washout = toNonNegative(washoutFraction, 'washoutFraction');
  return {
    gaugeBbl: round(capacity * length, 1),
    washedBbl: round(capacity * length * (1 + washout), 1),
    capacityBblPerFoot: round(capacity, 5),
  };
}

/**
 * Annular volume once a string is in it.
 */
export function sectionAnnularVolume({
  bitDiameterInches,
  pipeOdInches,
  lengthFeet,
  washoutFraction = 0,
}) {
  const capacity = annularCapacity(bitDiameterInches, pipeOdInches);
  const length = toNonNegative(lengthFeet, 'lengthFeet');
  return round(capacity * length * (1 + toNonNegative(washoutFraction, 'washoutFraction')), 1);
}

/**
 * The mud a section will need built, start to finish.
 */
export function sectionMudPlan({
  bitDiameterInches,
  lengthFeet,
  washoutFraction = 0.1,
  surfaceSystemBbl,
  targetSolidsFraction = 0.05,
  removalEfficiency = 0.5,
  cuttingsLiquidShare = 0.35,
}) {
  const hole = sectionHoleVolume({ bitDiameterInches, lengthFeet, washoutFraction });
  const solids = solidsGenerated({ bitDiameterInches, footageFeet: lengthFeet, washoutFraction });
  const dilution = dilutionToHold({
    targetFraction: targetSolidsFraction,
    solidsBbl: solids.barrels,
    removalEfficiency,
  });
  const discharge = retentionOnCuttings({
    rockBbl: solids.barrels,
    liquidShare: cuttingsLiquidShare,
  });
  const surface = toPositive(surfaceSystemBbl, 'surfaceSystemBbl');
  return {
    holeVolumeBbl: hole.washedBbl,
    surfaceSystemBbl: round(surface, 1),
    systemAtTotalDepthBbl: round(hole.washedBbl + surface, 1),
    drilledSolidsBbl: solids.barrels,
    dilutionBbl: dilution.dilutionBbl,
    lostOnCuttingsBbl: discharge.mudBbl,
    totalToBuildBbl: round(hole.washedBbl + surface + dilution.dilutionBbl + discharge.mudBbl, 1),
  };
}

/**
 * A product plan from a treatment rate per barrel built.
 */
export function sectionProductPlan({ plan, treatments, products }) {
  const prices = new Map(products.map((product) => [product.code, product]));
  const built = plan.totalToBuildBbl;
  const rows = treatments.map((treatment) => {
    const product = prices.get(treatment.code);
    if (!product) {
      throw new Error(`${treatment.code} is not on the price list`);
    }
    const perBarrel = toNonNegative(treatment.perBarrel, `${treatment.code} perBarrel`);
    const quantity = perBarrel * built;
    return {
      code: treatment.code,
      name: product.name,
      unit: product.unit,
      perBarrel,
      quantity: Math.ceil(quantity),
      value: round(Math.ceil(quantity) * product.pricePerUnit, 2),
    };
  });
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return {
    builtBbl: built,
    lines: rows.sort((a, b) => b.value - a.value),
    total: round(total, 2),
    costPerFoot: null,
  };
}

/**
 * The whole section, with a cost per foot on the end of it.
 */
export function sectionPlan({ section, treatments, products, surfaceSystemBbl, ...options }) {
  const length = toPositive(section.toFeet - section.fromFeet, 'section length');
  const plan = sectionMudPlan({
    bitDiameterInches: section.holeSizeInches,
    lengthFeet: length,
    surfaceSystemBbl,
    ...options,
  });
  const product = sectionProductPlan({ plan, treatments, products });
  return {
    name: section.name,
    fromFeet: section.fromFeet,
    toFeet: section.toFeet,
    lengthFeet: length,
    ...plan,
    products: product.lines,
    productCost: product.total,
    costPerFoot: round(product.total / length, 2),
  };
}
