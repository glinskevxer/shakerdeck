/**
 * Pills and sweeps.
 *
 * A pill is a small volume of something different pumped for one job. A
 * viscous sweep to pick a hole clean, a lost circulation pill to seal a thief
 * zone, a weighted pill to hold a shoe while the pipe is out. They are all
 * mixed the same way and the arithmetic that matters is the same: how much,
 * how strong, and where it will be when the pumps stop.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { LOW_GRAVITY_SG, POUNDS_PER_BARREL_WATER } from '../solids/analysis.js';
import { weightUp } from './weightup.js';

/** Lost circulation materials, by the size of the opening each will bridge. */
export const LOST_CIRCULATION_MATERIALS = {
  fine: { bridgesMicrons: 250, typicalLbBbl: 20, sackPounds: 50 },
  medium: { bridgesMicrons: 1000, typicalLbBbl: 30, sackPounds: 50 },
  coarse: { bridgesMicrons: 2500, typicalLbBbl: 40, sackPounds: 50 },
  'high concentration': { bridgesMicrons: 4000, typicalLbBbl: 80, sackPounds: 50 },
};

/**
 * Mix a lost circulation pill.
 */
export function lostCirculationPill({ grade, volumeBbl, concentrationLbBbl = null }) {
  const material = LOST_CIRCULATION_MATERIALS[grade];
  if (!material) {
    throw new Error(`there is no lost circulation grade called ${grade}`);
  }
  const volume = toPositive(volumeBbl, 'volumeBbl');
  const strength =
    concentrationLbBbl === null
      ? material.typicalLbBbl
      : toPositive(concentrationLbBbl, 'concentrationLbBbl');
  const pounds = strength * volume;
  return {
    grade,
    bridgesMicrons: material.bridgesMicrons,
    volumeBbl: round(volume, 1),
    concentrationLbBbl: strength,
    totalPounds: round(pounds, 0),
    sacks: Math.ceil(pounds / material.sackPounds),
    volumeIncreaseBbl: round(pounds / (POUNDS_PER_BARREL_WATER * LOW_GRAVITY_SG), 2),
  };
}

/**
 * A viscous sweep, sized to the annulus it has to fill.
 *
 * A sweep shorter than about two hundred feet of annulus disperses before it
 * reaches surface and does nothing at all, which is the usual reason a sweep
 * comes back clean on a hole that is packing off.
 */
export function viscousSweep({ annularCapacityBblPerFoot, coverFeet = 250 }) {
  const capacity = toPositive(annularCapacityBblPerFoot, 'annularCapacityBblPerFoot');
  const cover = toPositive(coverFeet, 'coverFeet');
  const volume = capacity * cover;
  return {
    volumeBbl: round(volume, 1),
    coverFeet: round(cover, 0),
    tooSmall: cover < 200,
  };
}

/**
 * A weighted pill spotted to hold a shoe.
 */
export function weightedPill({ pillPpg, mudPpg, volumeBbl, agent = 'barite' }) {
  const build = weightUp({ fromPpg: mudPpg, toPpg: pillPpg, volumeBbl, agent });
  return {
    pillPpg,
    volumeBbl: round(toPositive(volumeBbl, 'volumeBbl'), 1),
    ...build,
  };
}

/**
 * Where a pill sits when the pumps stop.
 *
 * The pill is chased down the string and out into the annulus, and the number
 * that is wanted is the depth of its top and its bottom once the chase is
 * finished.
 */
export function pillPlacement({
  pillBbl,
  chaseBbl,
  stringCapacityBbl,
  annularCapacityBblPerFoot,
  totalDepthFeet,
}) {
  const pill = toPositive(pillBbl, 'pillBbl');
  const chase = toNonNegative(chaseBbl, 'chaseBbl');
  const string = toPositive(stringCapacityBbl, 'stringCapacityBbl');
  const capacity = toPositive(annularCapacityBblPerFoot, 'annularCapacityBblPerFoot');
  const depth = toPositive(totalDepthFeet, 'totalDepthFeet');
  if (chase < string) {
    const feetDown = (chase / string) * depth;
    return {
      inString: true,
      pillTopFeet: round(Math.max(0, feetDown - pill / (string / depth)), 0),
      pillBottomFeet: round(feetDown, 0),
      shortBySeveral: round(string - chase, 2),
    };
  }
  const intoAnnulus = chase - string;
  const bottomUp = intoAnnulus / capacity;
  const pillLength = pill / capacity;
  return {
    inString: false,
    pillBottomFeet: round(Math.max(0, depth - bottomUp), 0),
    pillTopFeet: round(Math.max(0, depth - bottomUp - pillLength), 0),
    pillLengthFeet: round(pillLength, 0),
  };
}
