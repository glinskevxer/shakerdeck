/**
 * Dilution, and what it costs.
 *
 * Drilled solids only leave the system two ways: through the solids control
 * equipment, or out with mud that gets thrown away. Dilution is the second one
 * and it is always the expensive one, because every barrel of water added to a
 * weighted mud has to be weighted back up and treated again.
 *
 * The comparison at the bottom is the argument for buying a centrifuge, and it
 * is worth printing on the daily report where the drilling superintendent can
 * see it.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { LOW_GRAVITY_SG, POUNDS_PER_BARREL_WATER } from '../solids/analysis.js';

/**
 * Volume of solids a bit makes, in barrels per foot.
 */
export function solidsPerFoot(bitDiameterInches) {
  const bit = toPositive(bitDiameterInches, 'bitDiameterInches');
  return (bit * bit) / 1029.4;
}

/**
 * Solids made over a length of hole, with an allowance for washout.
 */
export function solidsGenerated({ bitDiameterInches, footageFeet, washoutFraction = 0 }) {
  const footage = toNonNegative(footageFeet, 'footageFeet');
  const washout = toNonNegative(washoutFraction, 'washoutFraction');
  const bbl = solidsPerFoot(bitDiameterInches) * footage * (1 + washout);
  return {
    barrels: round(bbl, 2),
    pounds: round(bbl * POUNDS_PER_BARREL_WATER * LOW_GRAVITY_SG, 0),
  };
}

/**
 * Dilution to bring a drilled solids fraction down, letting the volume grow.
 */
export function dilutionToTarget({ fromFraction, toFraction, volumeBbl }) {
  const from = toPositive(fromFraction, 'fromFraction');
  const target = toPositive(toFraction, 'toFraction');
  const volume = toPositive(volumeBbl, 'volumeBbl');
  if (target >= from) {
    throw new Error(`${target} is not below the ${from} the mud is at now`);
  }
  const added = (volume * (from - target)) / target;
  return {
    addedBbl: round(added, 1),
    finalVolumeBbl: round(volume + added, 1),
  };
}

/**
 * Dilution with a dump, so the system ends the size it started.
 */
export function dilutionHoldingVolume({ fromFraction, toFraction, volumeBbl }) {
  const from = toPositive(fromFraction, 'fromFraction');
  const target = toPositive(toFraction, 'toFraction');
  const volume = toPositive(volumeBbl, 'volumeBbl');
  if (target >= from) {
    throw new Error(`${target} is not below the ${from} the mud is at now`);
  }
  const discard = volume * (1 - target / from);
  return {
    discardBbl: round(discard, 1),
    addedBbl: round(discard, 1),
    finalVolumeBbl: round(volume, 1),
  };
}

/**
 * Dilution needed to hold a fraction steady while a hole section is drilled.
 *
 * The solids arriving have to be matched barrel for barrel by the dilution
 * that carries them, less whatever the shakers and the centrifuge took out.
 */
export function dilutionToHold({ targetFraction, solidsBbl, removalEfficiency = 0 }) {
  const target = toPositive(targetFraction, 'targetFraction');
  const solids = toNonNegative(solidsBbl, 'solidsBbl');
  const removal = toNonNegative(removalEfficiency, 'removalEfficiency');
  if (removal >= 1) {
    return { dilutionBbl: 0, retainedSolidsBbl: 0 };
  }
  const retained = solids * (1 - removal);
  return {
    dilutionBbl: round(retained / target - retained, 1),
    retainedSolidsBbl: round(retained, 2),
  };
}

/**
 * What a dilution costs, once the mud thrown away and the barite to put the
 * weight back are counted.
 */
export function dilutionCost({
  dilutionBbl,
  discardBbl = 0,
  waterCostPerBbl = 0,
  mudCostPerBbl,
  bariteCostPerBbl = 0,
}) {
  const dilution = toNonNegative(dilutionBbl, 'dilutionBbl');
  const discard = toNonNegative(discardBbl, 'discardBbl');
  const water = toNonNegative(waterCostPerBbl, 'waterCostPerBbl');
  const mud = toNonNegative(mudCostPerBbl, 'mudCostPerBbl');
  const barite = toNonNegative(bariteCostPerBbl, 'bariteCostPerBbl');
  const waterCost = dilution * water;
  const discardCost = discard * mud;
  const treatCost = dilution * barite;
  return {
    waterCost: round(waterCost, 2),
    discardedMudCost: round(discardCost, 2),
    retreatmentCost: round(treatCost, 2),
    totalCost: round(waterCost + discardCost + treatCost, 2),
  };
}

/**
 * Dilution against removal, side by side.
 *
 * Removal wins whenever the equipment can be kept running, and this puts a
 * number on how much it wins by over a hole section.
 */
export function dilutionAgainstRemoval({
  solidsBbl,
  targetFraction,
  removalEfficiency,
  mudCostPerBbl,
  removalCostPerBbl,
}) {
  const withoutRemoval = dilutionToHold({ targetFraction, solidsBbl, removalEfficiency: 0 });
  const withRemoval = dilutionToHold({ targetFraction, solidsBbl, removalEfficiency });
  const mud = toNonNegative(mudCostPerBbl, 'mudCostPerBbl');
  const removal = toNonNegative(removalCostPerBbl, 'removalCostPerBbl');
  const removedBbl =
    toNonNegative(solidsBbl, 'solidsBbl') * toNonNegative(removalEfficiency, 'removalEfficiency');
  const dilutionOnly = withoutRemoval.dilutionBbl * mud;
  const withEquipment = withRemoval.dilutionBbl * mud + removedBbl * removal;
  return {
    dilutionOnlyBbl: withoutRemoval.dilutionBbl,
    withRemovalBbl: withRemoval.dilutionBbl,
    removedBbl: round(removedBbl, 2),
    dilutionOnlyCost: round(dilutionOnly, 2),
    withRemovalCost: round(withEquipment, 2),
    savedCost: round(dilutionOnly - withEquipment, 2),
  };
}
