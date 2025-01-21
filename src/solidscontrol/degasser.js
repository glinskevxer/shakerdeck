/**
 * The degasser, and what it can actually keep up with.
 *
 * A vacuum degasser is rated at a throughput and the mud coming back is
 * whatever the well is giving. When the second is larger than the first the
 * gas goes round again, the suction pit stays cut, and the pump starts losing
 * efficiency in a way that reads on the standpipe as a bit that has washed out.
 *
 * Everything here is a rate comparison. There is no chemistry in it.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { gasCutPressureLoss } from '../mudcheck/gas.js';

/** What each kind of unit will take, in gallons a minute. */
export const DEGASSER_TYPES = {
  'vacuum, small': { capacityGpm: 300, removes: 0.9 },
  'vacuum, large': { capacityGpm: 800, removes: 0.9 },
  atmospheric: { capacityGpm: 500, removes: 0.55 },
  'poor boy': { capacityGpm: 1200, removes: 0.35 },
};

function unitOf(name) {
  const unit = DEGASSER_TYPES[name];
  if (!unit) {
    throw new Error(`there is no degasser called ${name}`);
  }
  return { ...unit, name };
}

/**
 * Whether the unit sees the whole return rate.
 */
export function throughput({ type, flowGpm }) {
  const unit = unitOf(type);
  const flow = toPositive(flowGpm, 'flowGpm');
  const share = Math.min(1, unit.capacityGpm / flow);
  return {
    type: unit.name,
    capacityGpm: unit.capacityGpm,
    circulatingGpm: flow,
    processedShare: round(share, 3),
    keepingUp: unit.capacityGpm >= flow,
  };
}

/**
 * How much of the gas actually leaves, over one pass.
 */
export function removalOnePass({ type, flowGpm }) {
  const unit = unitOf(type);
  const seen = throughput({ type, flowGpm });
  return round(unit.removes * seen.processedShare, 3);
}

/**
 * How cut the mud stays once the system reaches a steady state.
 *
 * Gas that is not removed comes back round, so the cut settles where what
 * comes in each circulation matches what leaves.
 */
export function steadyCut({ type, flowGpm, gasInPerCirculationPpg, uncutPpg }) {
  const removal = removalOnePass({ type, flowGpm });
  const arriving = toNonNegative(gasInPerCirculationPpg, 'gasInPerCirculationPpg');
  const uncut = toPositive(uncutPpg, 'uncutPpg');
  if (removal === 0) {
    return { cutPpg: 0, steadyCutPpg: null, neverSettles: true };
  }
  const steady = arriving / removal;
  const cut = Math.max(0.1, uncut - steady);
  return {
    removalOnePass: removal,
    steadyCutPpg: round(steady, 3),
    cutPpg: round(cut, 2),
    neverSettles: false,
  };
}

/**
 * What the steady cut is worth at the bottom of the hole, which is the point
 * of working it out at all.
 */
export function degasserWorth({ type, flowGpm, gasInPerCirculationPpg, uncutPpg, tvdFeet }) {
  const settled = steadyCut({ type, flowGpm, gasInPerCirculationPpg, uncutPpg });
  if (settled.neverSettles) {
    return { ...settled, lossPsi: null, withoutLossPsi: null, savedPsi: null };
  }
  const withUnit = gasCutPressureLoss({ uncutPpg, cutPpg: settled.cutPpg, tvdFeet });
  const without = gasCutPressureLoss({
    uncutPpg,
    cutPpg: Math.max(0.1, uncutPpg - gasInPerCirculationPpg * 4),
    tvdFeet,
  });
  return {
    ...settled,
    lossPsi: withUnit.lossPsi,
    withoutLossPsi: without.lossPsi,
    savedPsi: round(without.lossPsi - withUnit.lossPsi, 1),
  };
}

/**
 * Rank the units on the rig against a return rate.
 */
export function compareDegassers({ flowGpm, gasInPerCirculationPpg, uncutPpg, tvdFeet }) {
  return Object.keys(DEGASSER_TYPES)
    .map((type) => ({
      type,
      ...throughput({ type, flowGpm }),
      ...degasserWorth({ type, flowGpm, gasInPerCirculationPpg, uncutPpg, tvdFeet }),
    }))
    .sort((a, b) => (b.cutPpg ?? 0) - (a.cutPpg ?? 0));
}
