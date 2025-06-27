/**
 * Where the casing has to go, from the mud's point of view.
 *
 * The casing seat is chosen so the mud that is needed to hold the formation
 * below it does not break down the formation at the shoe above it. That is a
 * pore pressure and a fracture gradient argument, and the mud engineer is the
 * one holding both numbers.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/** The margins a programme carries by default, in pounds a gallon. */
export const DEFAULT_MARGINS = { trip: 0.5, kick: 0.5 };

/**
 * The mud weight a depth needs, with the trip margin on it.
 */
export function weightForDepth({ porePressurePpg, tripMargin = DEFAULT_MARGINS.trip }) {
  return round(
    toPositive(porePressurePpg, 'porePressurePpg') + toNonNegative(tripMargin, 'tripMargin'),
    2
  );
}

/**
 * The deepest a section can go on the shoe it has.
 *
 * Walks the pressure profile down until the weight the next depth needs, plus
 * the kick margin, is more than the shoe will take.
 */
export function deepestOnThisShoe({
  profile,
  shoeFractureGradientPpg,
  tripMargin = DEFAULT_MARGINS.trip,
  kickMargin = DEFAULT_MARGINS.kick,
}) {
  const fracture = toPositive(shoeFractureGradientPpg, 'shoeFractureGradientPpg');
  let last = null;
  for (const point of profile) {
    const needed = weightForDepth({ porePressurePpg: point.porePressurePpg, tripMargin });
    if (needed + toNonNegative(kickMargin, 'kickMargin') > fracture) {
      return {
        depthFeet: last === null ? null : last.depthFeet,
        stoppedBy: point.depthFeet,
        neededPpg: needed,
        shoeTakesPpg: round(fracture, 2),
      };
    }
    last = point;
  }
  return {
    depthFeet: last === null ? null : last.depthFeet,
    stoppedBy: null,
    neededPpg:
      last === null ? null : weightForDepth({ porePressurePpg: last.porePressurePpg, tripMargin }),
    shoeTakesPpg: round(fracture, 2),
  };
}

/**
 * Work the seats down the well.
 */
export function planSeats({ profile, surfaceFractureGradientPpg, ...margins }) {
  if (!Array.isArray(profile) || profile.length === 0) {
    throw new Error('a casing plan needs a pressure profile');
  }
  const seats = [];
  let from = 0;
  let shoeFracture = toPositive(surfaceFractureGradientPpg, 'surfaceFractureGradientPpg');
  let remaining = profile.filter((point) => point.depthFeet > from);
  let guard = 0;
  while (remaining.length > 0 && guard < 20) {
    guard += 1;
    const reach = deepestOnThisShoe({
      profile: remaining,
      shoeFractureGradientPpg: shoeFracture,
      ...margins,
    });
    if (reach.depthFeet === null) {
      seats.push({
        fromFeet: from,
        toFeet: remaining[0].depthFeet,
        impossible: true,
        neededPpg: reach.neededPpg,
        shoeTakesPpg: reach.shoeTakesPpg,
      });
      break;
    }
    seats.push({
      fromFeet: from,
      toFeet: reach.depthFeet,
      lengthFeet: reach.depthFeet - from,
      neededPpg: reach.neededPpg,
      shoeTakesPpg: reach.shoeTakesPpg,
      stoppedBy: reach.stoppedBy,
      impossible: false,
    });
    if (reach.stoppedBy === null) {
      break;
    }
    from = reach.depthFeet;
    shoeFracture =
      profile.find((point) => point.depthFeet === from)?.fractureGradientPpg ?? shoeFracture;
    remaining = profile.filter((point) => point.depthFeet > from);
  }
  return {
    seats,
    strings: seats.length,
    reachesTotalDepth: seats.at(-1)?.toFeet === profile.at(-1).depthFeet,
  };
}

/**
 * The window at one depth, which is what the daily report prints.
 */
export function windowAt({ point, margins = DEFAULT_MARGINS }) {
  const pore = toPositive(point.porePressurePpg, 'porePressurePpg');
  const fracture = toPositive(point.fractureGradientPpg, 'fractureGradientPpg');
  return {
    depthFeet: point.depthFeet,
    floorPpg: round(pore + margins.trip, 2),
    ceilingPpg: round(fracture, 2),
    widthPpg: round(fracture - pore - margins.trip, 2),
    workable: fracture - pore - margins.trip > 0,
  };
}
