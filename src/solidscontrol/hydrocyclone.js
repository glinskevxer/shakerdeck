/**
 * Desanders and desilters.
 *
 * A cone has no moving parts and no adjustment worth the name. It cuts where
 * its diameter says it cuts, it passes what it passes, and the only decisions
 * are how many cones are on the manifold and whether they are fed enough to
 * work at all.
 *
 * The rule that gets broken is the feed rate. A bank of cones has to see more
 * than the circulating rate or part of the mud goes round the hole without
 * ever passing through them, and a bank that is short is worth nothing however
 * good the cut point is.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { removalShare, passedDistribution } from './screens.js';

/**
 * Cone sizes and what each one does, from the manufacturers' figures.
 */
export const CONE_TYPES = {
  desander: { diameterInches: 12, cutMicrons: 45, capacityGpm: 500 },
  'small desander': { diameterInches: 10, cutMicrons: 35, capacityGpm: 350 },
  desilter: { diameterInches: 4, cutMicrons: 20, capacityGpm: 60 },
  'small desilter': { diameterInches: 2, cutMicrons: 12, capacityGpm: 25 },
};

function coneOf(name) {
  const cone = CONE_TYPES[name];
  if (!cone) {
    throw new Error(`there is no cone called ${name}`);
  }
  return { ...cone, name };
}

/**
 * How many cones are needed to see the whole circulating rate, with headroom.
 */
export function conesNeeded({ type, flowGpm, headroom = 0.25 }) {
  const cone = coneOf(type);
  const flow = toPositive(flowGpm, 'flowGpm');
  const spare = toNonNegative(headroom, 'headroom');
  return {
    type: cone.name,
    cones: Math.ceil((flow * (1 + spare)) / cone.capacityGpm),
    capacityEach: cone.capacityGpm,
    cutMicrons: cone.cutMicrons,
  };
}

/**
 * Whether a bank on the manifold is fed enough to do anything.
 */
export function bankCapacity({ type, cones, flowGpm }) {
  const cone = coneOf(type);
  const count = toPositive(cones, 'cones');
  const flow = toPositive(flowGpm, 'flowGpm');
  const capacity = count * cone.capacityGpm;
  return {
    type: cone.name,
    cones: count,
    capacityGpm: capacity,
    circulatingGpm: flow,
    processedShare: round(Math.min(1, capacity / flow), 3),
    fullyProcessing: capacity >= flow,
    headroomShare: round(capacity / flow - 1, 3),
  };
}

/**
 * What a bank takes out of a cuttings size distribution.
 *
 * A bank that only sees part of the flow only removes from the part it sees,
 * which is the whole reason the feed rate matters.
 */
export function conePerformance({ type, cones, flowGpm, distribution, solidsBbl }) {
  const cone = coneOf(type);
  const bank = bankCapacity({ type, cones, flowGpm });
  const share = removalShare(distribution, cone.cutMicrons) * bank.processedShare;
  const solids = toNonNegative(solidsBbl, 'solidsBbl');
  return {
    type: cone.name,
    cutMicrons: cone.cutMicrons,
    processedShare: bank.processedShare,
    removalShare: round(share, 3),
    removedBbl: round(solids * share, 2),
    passedBbl: round(solids * (1 - share), 2),
    fullyProcessing: bank.fullyProcessing,
    passedDistribution: passedDistribution(distribution, cone.cutMicrons),
  };
}

/**
 * A shaker, then a desander, then a desilter, each one seeing what the last
 * one left. The order matters and the arithmetic is not the sum of the three
 * on their own.
 */
export function trainPerformance({ stages, distribution, solidsBbl }) {
  let remaining = toNonNegative(solidsBbl, 'solidsBbl');
  let sizes = distribution;
  const rows = [];
  for (const stage of stages) {
    const result = conePerformance({ ...stage, distribution: sizes, solidsBbl: remaining });
    rows.push({ ...result, feedBbl: round(remaining, 2) });
    remaining = result.passedBbl;
    sizes = result.passedDistribution;
  }
  return {
    stages: rows,
    removedBbl: round(toNonNegative(solidsBbl, 'solidsBbl') - remaining, 2),
    passedBbl: round(remaining, 2),
    removalShare:
      solidsBbl === 0
        ? 0
        : round((toNonNegative(solidsBbl, 'solidsBbl') - remaining) / solidsBbl, 3),
  };
}
