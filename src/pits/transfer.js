/**
 * Moving mud between pits.
 *
 * A transfer changes two volumes and one weight, and on a rig with two systems
 * lined up it changes the weight of both. Doing it on paper first is the only
 * way to know whether the receiving pit ends up where it needs to be, and it
 * is the difference between one transfer and three.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { blendWeight } from '../material/weightup.js';

/**
 * Move a volume from one pit to another.
 */
export function transfer({ from, to, volumeBbl }) {
  const moved = toPositive(volumeBbl, 'volumeBbl');
  const fromVolume = toNonNegative(from?.volumeBbl, 'from volumeBbl');
  const toVolume = toNonNegative(to?.volumeBbl, 'to volumeBbl');
  if (moved > fromVolume) {
    throw new Error(`${from.name ?? 'the pit'} only holds ${fromVolume} barrels`);
  }
  const blended = blendWeight([
    { volumeBbl: toVolume, weightPpg: to.weightPpg },
    { volumeBbl: moved, weightPpg: from.weightPpg },
  ]);
  return {
    movedBbl: round(moved, 1),
    from: {
      name: from.name ?? 'from',
      volumeBbl: round(fromVolume - moved, 1),
      weightPpg: round(from.weightPpg, 2),
    },
    to: {
      name: to.name ?? 'to',
      volumeBbl: blended.volumeBbl,
      weightPpg: blended.weightPpg,
    },
  };
}

/**
 * The volume to move to land the receiving pit on a weight.
 */
export function transferForWeight({ from, to, targetPpg }) {
  const target = toPositive(targetPpg, 'targetPpg');
  const source = toPositive(from?.weightPpg, 'from weightPpg');
  const receiving = toPositive(to?.weightPpg, 'to weightPpg');
  const volume = toNonNegative(to?.volumeBbl, 'to volumeBbl');
  if ((target - receiving) * (source - target) < 0) {
    throw new Error(`${target} is not between ${receiving} and ${source}`);
  }
  if (source === target) {
    throw new Error(`the pit being moved from is already at ${target}`);
  }
  const moved = (volume * (target - receiving)) / (source - target);
  const held = toNonNegative(from?.volumeBbl, 'from volumeBbl');
  return {
    volumeBbl: round(moved, 1),
    enoughInThePit: moved <= held,
    shortBy: moved > held ? round(moved - held, 1) : 0,
  };
}

/**
 * Run a list of transfers in order, so the whole tour can be checked at once.
 */
export function runTransfers({ pits, transfers }) {
  const held = new Map(
    pits.map((pit) => [pit.name, { ...pit, volumeBbl: pit.volumeBbl, weightPpg: pit.weightPpg }])
  );
  const rows = [];
  for (const [index, move] of transfers.entries()) {
    const source = held.get(move.from);
    const destination = held.get(move.to);
    if (!source) {
      throw new Error(`transfer ${index + 1} is from ${move.from}, which is not a pit`);
    }
    if (!destination) {
      throw new Error(`transfer ${index + 1} is to ${move.to}, which is not a pit`);
    }
    const result = transfer({ from: source, to: destination, volumeBbl: move.volumeBbl });
    held.set(move.from, { ...source, ...result.from });
    held.set(move.to, { ...destination, ...result.to });
    rows.push({ order: index + 1, ...move, ...result });
  }
  return {
    transfers: rows,
    pits: [...held.values()].map((pit) => ({
      name: pit.name,
      volumeBbl: round(pit.volumeBbl, 1),
      weightPpg: round(pit.weightPpg, 2),
    })),
  };
}
