/**
 * Weighting up and cutting back.
 *
 * All of it is one volume balance: whatever goes in adds its own volume and
 * its own weight, and the mud that comes out is the two together. The only
 * thing that changes between barite, hematite and calcium carbonate is the
 * density of what is being added.
 *
 * The volume increase is the part that gets forgotten. Weighting a full system
 * up two pounds puts several hundred barrels on the ground unless something is
 * dumped first, and that is a pit the rig may not have.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { WATER_PPG } from '../units/density.js';
import { POUNDS_PER_BARREL_WATER } from '../solids/analysis.js';

/** The weighting agents the desk carries, by specific gravity. */
export const WEIGHTING_AGENTS = {
  barite: { sg: 4.2, sackPounds: 100 },
  hematite: { sg: 4.9, sackPounds: 100 },
  'calcium carbonate': { sg: 2.7, sackPounds: 50 },
  'iron carbonate': { sg: 3.8, sackPounds: 100 },
};

function agentOf(name) {
  const agent = WEIGHTING_AGENTS[name];
  if (!agent) {
    throw new Error(`there is no weighting agent called ${name}`);
  }
  return { ...agent, name, ppg: agent.sg * WATER_PPG };
}

/**
 * Weight a system up, letting the volume grow.
 */
export function weightUp({ fromPpg, toPpg, volumeBbl, agent = 'barite' }) {
  const from = toPositive(fromPpg, 'fromPpg');
  const target = toPositive(toPpg, 'toPpg');
  const volume = toPositive(volumeBbl, 'volumeBbl');
  const weighting = agentOf(agent);
  if (target <= from) {
    throw new Error(`${target} is not above the ${from} the mud is at now`);
  }
  if (target >= weighting.ppg) {
    throw new Error(`${agent} weighs ${round(weighting.ppg, 2)}, it cannot make a ${target} mud`);
  }
  const perBarrel = (target - from) / (weighting.ppg - target);
  const addedBbl = perBarrel * volume;
  const pounds = addedBbl * POUNDS_PER_BARREL_WATER * weighting.sg;
  return {
    agent: weighting.name,
    poundsPerBarrel: round(pounds / volume, 1),
    totalPounds: round(pounds, 0),
    sacks: Math.ceil(pounds / weighting.sackPounds),
    volumeIncreaseBbl: round(addedBbl, 1),
    finalVolumeBbl: round(volume + addedBbl, 1),
  };
}

/**
 * Weight a system up while holding the volume where it is, which means dumping
 * mud before the barite goes in.
 */
export function weightUpHoldingVolume({ fromPpg, toPpg, volumeBbl, agent = 'barite' }) {
  const straight = weightUp({ fromPpg, toPpg, volumeBbl, agent });
  const volume = toPositive(volumeBbl, 'volumeBbl');
  const keep = (volume * volume) / straight.finalVolumeBbl;
  const discard = volume - keep;
  const scaled = weightUp({ fromPpg, toPpg, volumeBbl: keep, agent });
  return {
    ...scaled,
    discardBbl: round(discard, 1),
    finalVolumeBbl: round(keep + scaled.volumeIncreaseBbl, 1),
  };
}

/**
 * Cut a system back with water or base oil.
 */
export function cutBack({ fromPpg, toPpg, volumeBbl, dilutantPpg = WATER_PPG }) {
  const from = toPositive(fromPpg, 'fromPpg');
  const target = toPositive(toPpg, 'toPpg');
  const volume = toPositive(volumeBbl, 'volumeBbl');
  const dilutant = toPositive(dilutantPpg, 'dilutantPpg');
  if (target >= from) {
    throw new Error(`${target} is not below the ${from} the mud is at now`);
  }
  if (target <= dilutant) {
    throw new Error(`a ${round(dilutant, 2)} pound dilutant cannot make a ${target} mud`);
  }
  const added = (volume * (from - target)) / (target - dilutant);
  return {
    addedBbl: round(added, 1),
    finalVolumeBbl: round(volume + added, 1),
    discardToHoldVolumeBbl: round(added, 1),
  };
}

/**
 * The weight two muds make when they are run together.
 */
export function blendWeight(parts) {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('a blend needs at least one part');
  }
  let volume = 0;
  let weight = 0;
  parts.forEach((part, index) => {
    const bbl = toNonNegative(part?.volumeBbl, `part ${index + 1} volumeBbl`);
    const ppg = toPositive(part?.weightPpg, `part ${index + 1} weightPpg`);
    volume += bbl;
    weight += bbl * ppg;
  });
  if (volume === 0) {
    throw new Error('a blend of nothing has no weight');
  }
  return {
    volumeBbl: round(volume, 1),
    weightPpg: round(weight / volume, 2),
  };
}

/**
 * How much of a heavy mud to run into a light one to hit a weight.
 */
export function blendToTarget({ lightPpg, heavyPpg, targetPpg, lightVolumeBbl }) {
  const light = toPositive(lightPpg, 'lightPpg');
  const heavy = toPositive(heavyPpg, 'heavyPpg');
  const target = toPositive(targetPpg, 'targetPpg');
  const volume = toPositive(lightVolumeBbl, 'lightVolumeBbl');
  if (target <= light || target >= heavy) {
    throw new Error(`${target} is not between ${light} and ${heavy}`);
  }
  const heavyVolume = (volume * (target - light)) / (heavy - target);
  return {
    heavyVolumeBbl: round(heavyVolume, 1),
    finalVolumeBbl: round(volume + heavyVolume, 1),
  };
}
