/**
 * Building mud, and how long it takes.
 *
 * A mixing order that cannot be mixed in the time available is not a mixing
 * order. The hopper takes sacks at a rate a man can cut them, the polymers
 * need shear and time before they do anything, and a barite slurry that is
 * pumped before it has yielded settles in the pit it was mixed in.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/** What each kind of product needs before it is worth anything. */
export const MIXING_RULES = {
  weighting: { sacksPerMinute: 6, shearMinutes: 0, yieldMinutes: 0 },
  polymer: { sacksPerMinute: 2, shearMinutes: 15, yieldMinutes: 30 },
  clay: { sacksPerMinute: 4, shearMinutes: 10, yieldMinutes: 240 },
  alkalinity: { sacksPerMinute: 4, shearMinutes: 5, yieldMinutes: 0 },
  'lost circulation': { sacksPerMinute: 8, shearMinutes: 0, yieldMinutes: 0 },
  general: { sacksPerMinute: 4, shearMinutes: 5, yieldMinutes: 0 },
};

function ruleFor(category) {
  return MIXING_RULES[category] ?? MIXING_RULES.general;
}

/**
 * How long one product takes to go in and become useful.
 */
export function mixTime({ category = 'general', sacks, hopperShare = 1 }) {
  const rule = ruleFor(category);
  const count = toNonNegative(sacks, 'sacks');
  const share = toPositive(hopperShare, 'hopperShare');
  if (share > 1) {
    throw new Error(`a hopper share of ${share} is more than the whole hopper`);
  }
  const cutting = count / (rule.sacksPerMinute * share);
  return {
    category,
    sacks: count,
    cuttingMinutes: round(cutting, 1),
    shearMinutes: rule.shearMinutes,
    yieldMinutes: rule.yieldMinutes,
    readyInMinutes: round(cutting + rule.shearMinutes + rule.yieldMinutes, 1),
  };
}

/**
 * A whole order through one hopper, one product after another.
 */
export function mixingOrder({ lines, hopperShare = 1 }) {
  let cutting = 0;
  const rows = lines.map((line) => {
    const timed = mixTime({ category: line.category, sacks: line.sacks, hopperShare });
    cutting += timed.cuttingMinutes;
    return {
      code: line.code,
      name: line.name,
      ...timed,
      startsAtMinute: round(cutting - timed.cuttingMinutes, 1),
      readyAtMinute: round(cutting + timed.shearMinutes + timed.yieldMinutes, 1),
    };
  });
  return {
    lines: rows,
    cuttingMinutes: round(cutting, 1),
    readyInMinutes: round(Math.max(...rows.map((row) => row.readyAtMinute)), 1),
    lastReady: rows.reduce((latest, row) =>
      row.readyAtMinute > latest.readyAtMinute ? row : latest
    ),
  };
}

/**
 * Whether the order fits in the time before it is needed.
 */
export function fitsTheWindow({ order, minutesAvailable }) {
  const available = toPositive(minutesAvailable, 'minutesAvailable');
  const over = order.readyInMinutes - available;
  return {
    readyInMinutes: order.readyInMinutes,
    minutesAvailable: available,
    fits: over <= 0,
    shortByMinutes: over > 0 ? round(over, 1) : 0,
    holdingItUp: over > 0 ? (order.lastReady.name ?? order.lastReady.code) : null,
  };
}

/**
 * The order the products should go in.
 *
 * Anything that needs to yield goes first, because the clock on it starts when
 * it is cut and nothing else on the order shortens it.
 */
export function mixingSequence(lines) {
  return [...lines].sort((a, b) => {
    const left = ruleFor(a.category);
    const right = ruleFor(b.category);
    if (right.yieldMinutes !== left.yieldMinutes) {
      return right.yieldMinutes - left.yieldMinutes;
    }
    return right.shearMinutes - left.shearMinutes;
  });
}
