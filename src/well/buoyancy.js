/**
 * What the mud does to the weight of the string.
 *
 * Steel hung in mud weighs less than steel hung in air, by exactly the mud it
 * displaces. The driller sees it on the weight indicator and the mud engineer
 * is the one who changed it, because every weight up takes hookload off and
 * every cut back puts it back on.
 *
 * It is also the reason a string that was fine at twelve pounds buckles at
 * sixteen: the buoyed weight below the neutral point is what holds the string
 * in compression, and the neutral point moves with the mud.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/** Pounds a gallon for steel at a specific gravity of 7.85. */
export const STEEL_PPG = 65.5;

/**
 * The buoyancy factor for a mud weight.
 */
export function buoyancyFactor(mudPpg) {
  const mud = toPositive(mudPpg, 'mudPpg');
  if (mud >= STEEL_PPG) {
    throw new Error(`a ${mud} pound mud would float steel`);
  }
  return round(1 - mud / STEEL_PPG, 4);
}

/**
 * Hookload for a string of a given weight in air.
 */
export function hookload({ airWeightPounds, mudPpg, blockWeightPounds = 0 }) {
  const air = toNonNegative(airWeightPounds, 'airWeightPounds');
  const blocks = toNonNegative(blockWeightPounds, 'blockWeightPounds');
  const factor = buoyancyFactor(mudPpg);
  return {
    buoyancyFactor: factor,
    buoyedWeightPounds: round(air * factor, 0),
    hookloadPounds: round(air * factor + blocks, 0),
    lostToBuoyancyPounds: round(air * (1 - factor), 0),
  };
}

/**
 * How much hookload a weight up costs.
 */
export function hookloadChange({ airWeightPounds, fromPpg, toPpg }) {
  const before = hookload({ airWeightPounds, mudPpg: fromPpg });
  const after = hookload({ airWeightPounds, mudPpg: toPpg });
  return {
    fromPpg,
    toPpg,
    beforePounds: before.buoyedWeightPounds,
    afterPounds: after.buoyedWeightPounds,
    changePounds: round(after.buoyedWeightPounds - before.buoyedWeightPounds, 0),
  };
}

/**
 * The neutral point: how far above the bit the string is in compression.
 *
 * Everything below it carries the weight on bit. Drill pipe below the neutral
 * point is drill pipe in compression, which is how a string gets bent.
 */
export function neutralPoint({ weightOnBitPounds, collarWeightPerFoot, mudPpg }) {
  const weight = toNonNegative(weightOnBitPounds, 'weightOnBitPounds');
  const perFoot = toPositive(collarWeightPerFoot, 'collarWeightPerFoot');
  const factor = buoyancyFactor(mudPpg);
  return round(weight / (perFoot * factor), 0);
}

/**
 * Whether the collars are long enough to carry the weight on bit.
 */
export function collarsEnough({
  weightOnBitPounds,
  collarLengthFeet,
  collarWeightPerFoot,
  mudPpg,
  designFactor = 1.15,
}) {
  const needed = neutralPoint({ weightOnBitPounds, collarWeightPerFoot, mudPpg });
  const available = toPositive(collarLengthFeet, 'collarLengthFeet');
  const withFactor = needed * toPositive(designFactor, 'designFactor');
  return {
    neutralPointFeet: needed,
    withDesignFactorFeet: round(withFactor, 0),
    collarLengthFeet: available,
    enough: available >= withFactor,
    shortByFeet: available >= withFactor ? 0 : round(withFactor - available, 0),
  };
}
