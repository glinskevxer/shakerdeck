/**
 * What the casing will take.
 *
 * The mud engineer does not choose the casing, but the mud is what loads it.
 * A weight up that is fine for the formation can put the burst load past the
 * pipe that is already in the hole, and a mud that is cut back can let the
 * collapse load past it from the other side.
 *
 * Ratings are as run: the pipe's own rating with the design factor already
 * taken off, because that is the number in the casing tally.
 */
import { toNumber, toPositive, toNonNegative, round } from '../util/number.js';
import { GRADIENT_PER_PPG } from '../units/density.js';

/**
 * Burst load on the casing at the shoe, from the mud inside against whatever
 * is outside it.
 */
export function burstLoad({ insidePpg, outsidePpg, shoeTvdFeet, surfacePsi = 0 }) {
  const inside = toPositive(insidePpg, 'insidePpg');
  const outside = toNonNegative(outsidePpg, 'outsidePpg');
  const shoe = toPositive(shoeTvdFeet, 'shoeTvdFeet');
  const surface = toNonNegative(surfacePsi, 'surfacePsi');
  return round(surface + GRADIENT_PER_PPG * (inside - outside) * shoe, 0);
}

/**
 * Collapse load, which is the other way round.
 */
export function collapseLoad({ insidePpg, outsidePpg, shoeTvdFeet, emptyToFeet = 0 }) {
  const inside = toNonNegative(insidePpg, 'insidePpg');
  const outside = toPositive(outsidePpg, 'outsidePpg');
  const shoe = toPositive(shoeTvdFeet, 'shoeTvdFeet');
  const empty = toNonNegative(emptyToFeet, 'emptyToFeet');
  if (empty > shoe) {
    throw new Error(`the string cannot be empty to ${empty} in a ${shoe} foot hole`);
  }
  const insideHead = GRADIENT_PER_PPG * inside * (shoe - empty);
  const outsideHead = GRADIENT_PER_PPG * outside * shoe;
  return round(Math.max(0, outsideHead - insideHead), 0);
}

/**
 * How much room is left against a rating.
 */
export function margin({ load, ratingPsi }) {
  const rating = toPositive(ratingPsi, 'ratingPsi');
  // A burst load comes back negative when the annulus is heavier than the
  // string, which is a real state and not an error. It loads the pipe the
  // other way, which is what the collapse figure is for.
  const applied = toNumber(load, 'load');
  return {
    loadPsi: round(applied, 0),
    ratingPsi: round(rating, 0),
    marginPsi: round(rating - applied, 0),
    usedShare: round(applied / rating, 3),
    over: applied > rating,
  };
}

/**
 * The heaviest mud the casing will carry on a burst load.
 */
export function heaviestMudForBurst({ outsidePpg, shoeTvdFeet, burstRatingPsi, surfacePsi = 0 }) {
  const outside = toNonNegative(outsidePpg, 'outsidePpg');
  const shoe = toPositive(shoeTvdFeet, 'shoeTvdFeet');
  const rating = toPositive(burstRatingPsi, 'burstRatingPsi');
  const surface = toNonNegative(surfacePsi, 'surfacePsi');
  return round(outside + (rating - surface) / (GRADIENT_PER_PPG * shoe), 2);
}

/**
 * Both loads on one string, as a casing check goes on the report.
 */
export function casingCheck({
  name,
  shoeTvdFeet,
  burstRatingPsi,
  collapseRatingPsi,
  insidePpg,
  outsidePpg,
  surfacePsi = 0,
  emptyToFeet = 0,
}) {
  const burst = margin({
    load: burstLoad({ insidePpg, outsidePpg, shoeTvdFeet, surfacePsi }),
    ratingPsi: burstRatingPsi,
  });
  const collapse = margin({
    load: collapseLoad({ insidePpg, outsidePpg, shoeTvdFeet, emptyToFeet }),
    ratingPsi: collapseRatingPsi,
  });
  return {
    name,
    shoeTvdFeet,
    burst,
    collapse,
    heaviestMudPpg: heaviestMudForBurst({
      outsidePpg,
      shoeTvdFeet,
      burstRatingPsi,
      surfacePsi,
    }),
    safe: !burst.over && !collapse.over,
  };
}
