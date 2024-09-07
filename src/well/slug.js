/**
 * Slugging the pipe.
 *
 * Before the string comes out, a heavy pill is pumped down so the top of it
 * falls and the pipe comes out dry. Too little and the driller wears the mud;
 * too much and the slug goes past the collars and does nothing useful. Both
 * are worked from the same balance: the heavy column falls until the head it
 * has lost matches the head the ordinary mud in the pipe still has.
 */
import { toPositive, round } from '../util/number.js';
import { GRADIENT_PER_PPG } from '../units/density.js';
import { weightUp } from '../material/weightup.js';

/**
 * How far the pipe comes out dry for a slug of a given volume.
 */
export function dryPipeLength({ slugBbl, slugPpg, mudPpg, capacityBblPerFoot }) {
  const volume = toPositive(slugBbl, 'slugBbl');
  const slug = toPositive(slugPpg, 'slugPpg');
  const mud = toPositive(mudPpg, 'mudPpg');
  const capacity = toPositive(capacityBblPerFoot, 'capacityBblPerFoot');
  if (slug <= mud) {
    throw new Error(`a ${slug} pound slug is not heavier than a ${mud} pound mud`);
  }
  const slugLength = volume / capacity;
  return round((slugLength * (slug - mud)) / mud, 1);
}

/**
 * The slug volume that gives a wanted length of dry pipe.
 */
export function slugVolume({ dryFeet, slugPpg, mudPpg, capacityBblPerFoot }) {
  const dry = toPositive(dryFeet, 'dryFeet');
  const slug = toPositive(slugPpg, 'slugPpg');
  const mud = toPositive(mudPpg, 'mudPpg');
  const capacity = toPositive(capacityBblPerFoot, 'capacityBblPerFoot');
  if (slug <= mud) {
    throw new Error(`a ${slug} pound slug is not heavier than a ${mud} pound mud`);
  }
  return round((dry * capacity * mud) / (slug - mud), 2);
}

/**
 * The pressure the slug is worth while it is still in the pipe.
 */
export function slugPressure({ slugBbl, slugPpg, mudPpg, capacityBblPerFoot }) {
  const volume = toPositive(slugBbl, 'slugBbl');
  const capacity = toPositive(capacityBblPerFoot, 'capacityBblPerFoot');
  const slug = toPositive(slugPpg, 'slugPpg');
  const mud = toPositive(mudPpg, 'mudPpg');
  return round(GRADIENT_PER_PPG * (slug - mud) * (volume / capacity), 1);
}

/**
 * The whole slug job, with the barite to build it.
 */
export function slugJob({ dryFeet, slugPpg, mudPpg, capacityBblPerFoot, agent = 'barite' }) {
  const volume = slugVolume({ dryFeet, slugPpg, mudPpg, capacityBblPerFoot });
  const build = weightUp({ fromPpg: mudPpg, toPpg: slugPpg, volumeBbl: volume, agent });
  return {
    slugBbl: volume,
    slugPpg,
    mudPpg,
    dryFeet: round(dryFeet, 0),
    slugLengthFeet: round(volume / capacityBblPerFoot, 0),
    pressurePsi: slugPressure({ slugBbl: volume, slugPpg, mudPpg, capacityBblPerFoot }),
    agent: build.agent,
    sacks: build.sacks,
    poundsPerBarrel: build.poundsPerBarrel,
    volumeAfterWeightingBbl: build.finalVolumeBbl,
  };
}

/**
 * What the pit gains back when the slug falls.
 *
 * The slug goes down and the mud it displaces comes back up into the pits, so
 * the totalizer moves and it is not a kick. It is worth printing beside the
 * slug so nobody has to argue about it at three in the morning.
 */
export function pitGainFromSlug({ dryFeet, capacityBblPerFoot }) {
  return round(
    toPositive(dryFeet, 'dryFeet') * toPositive(capacityBblPerFoot, 'capacityBblPerFoot'),
    2
  );
}
