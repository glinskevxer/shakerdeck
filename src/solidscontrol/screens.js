/**
 * Shaker screens.
 *
 * A screen is sold by its API number, which is not a mesh count and not a
 * micron size. API 13C ties the number to a band of cut points measured on the
 * built screen rather than on the wire it was woven from, which is why two
 * screens with the same mesh count can cut very differently.
 *
 * The desk works in cut points and prints the API number beside them, because
 * the number is what gets ordered and the cut point is what decides whether
 * the drilled solids leave the hole.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/**
 * API 13C designations, with the band of cut points in microns each covers.
 */
export const SCREEN_TABLE = [
  { api: 20, low: 780, high: 925 },
  { api: 30, low: 550, high: 655 },
  { api: 40, low: 390, high: 462.5 },
  { api: 50, low: 275, high: 327.5 },
  { api: 60, low: 196, high: 231 },
  { api: 70, low: 165, high: 196 },
  { api: 80, low: 137.5, high: 165 },
  { api: 100, low: 116, high: 137.5 },
  { api: 120, low: 98, high: 116 },
  { api: 140, low: 82.5, high: 98 },
  { api: 170, low: 69, high: 82.5 },
  { api: 200, low: 58, high: 69 },
  { api: 230, low: 49, high: 58 },
  { api: 270, low: 41, high: 49 },
  { api: 325, low: 34.5, high: 41 },
  { api: 400, low: 24.5, high: 29 },
];

/**
 * The cut point band for an API number.
 */
export function bandFor(apiNumber) {
  const row = SCREEN_TABLE.find((entry) => entry.api === apiNumber);
  if (!row) {
    throw new Error(`there is no api ${apiNumber} screen in the 13c table`);
  }
  return { ...row, midpoint: round((row.low + row.high) / 2, 1) };
}

/**
 * The API number a measured cut point falls in.
 */
export function designationFor(cutMicrons) {
  const cut = toPositive(cutMicrons, 'cutMicrons');
  // The bands touch at their edges, so a cut that lands exactly on one is in
  // two of them. The lower edge belongs to the band it opens, which puts a
  // reading of 69 microns in the api 170 band and not the 200 one.
  const coarsest = SCREEN_TABLE[0];
  if (cut === coarsest.high) {
    return coarsest.api;
  }
  const row = SCREEN_TABLE.find((entry) => cut >= entry.low && cut < entry.high);
  if (!row) {
    return null;
  }
  return row.api;
}

/**
 * The finest screen that will still pass the flow.
 *
 * Conductance falls as the screen gets finer, so the choice is always the
 * finest cloth the shaker can carry without flooding the end of the basket.
 */
export function finestScreenFor({ flowGpm, conductancePerGpm }) {
  const flow = toPositive(flowGpm, 'flowGpm');
  const needed = flow * toPositive(conductancePerGpm, 'conductancePerGpm');
  let chosen = null;
  for (const entry of SCREEN_TABLE) {
    const capacity = (entry.low + entry.high) / 2;
    if (capacity >= needed) {
      chosen = entry;
    }
  }
  return chosen ? bandFor(chosen.api) : null;
}

/**
 * The share of a cuttings size distribution a screen takes out.
 *
 * The distribution is a list of size bands with the share of the solids in
 * each. Anything coarser than the cut point goes over the end of the screen
 * and anything finer goes through it.
 */
export function removalShare(distribution, cutMicrons) {
  const cut = toPositive(cutMicrons, 'cutMicrons');
  let removed = 0;
  let total = 0;
  for (const band of distribution) {
    const share = toNonNegative(band?.share, 'share');
    const low = toNonNegative(band?.lowMicrons, 'lowMicrons');
    const high = toPositive(band?.highMicrons, 'highMicrons');
    if (high <= low) {
      throw new Error(`a band from ${low} to ${high} microns runs backwards`);
    }
    total += share;
    if (low >= cut) {
      removed += share;
    } else if (high > cut) {
      removed += (share * (high - cut)) / (high - low);
    }
  }
  if (total === 0) {
    throw new Error('the distribution adds up to nothing');
  }
  return removed / total;
}

/**
 * The size distribution of what got through.
 *
 * This is the piece that was missing. A stage does not see the same
 * distribution the one before it saw: everything coarser than the last cut
 * point has already gone. Running each stage against the original
 * distribution counts the same coarse solids again at every stage and reports
 * a spread removing ninety nine percent of what a rig actually removes half
 * of.
 */
export function passedDistribution(distribution, cutMicrons) {
  const cut = toPositive(cutMicrons, 'cutMicrons');
  const rows = [];
  for (const band of distribution) {
    const share = toNonNegative(band?.share, 'share');
    const low = toNonNegative(band?.lowMicrons, 'lowMicrons');
    const high = toPositive(band?.highMicrons, 'highMicrons');
    if (high <= low) {
      throw new Error(`a band from ${low} to ${high} microns runs backwards`);
    }
    if (low >= cut) {
      continue;
    }
    if (high <= cut) {
      rows.push({ lowMicrons: low, highMicrons: high, share });
      continue;
    }
    rows.push({
      lowMicrons: low,
      highMicrons: cut,
      share: (share * (cut - low)) / (high - low),
    });
  }
  return rows;
}

/**
 * What a screen does to a flow of drilled solids.
 */
export function screenPerformance({ apiNumber, distribution, solidsBbl }) {
  const band = bandFor(apiNumber);
  const share = removalShare(distribution, band.midpoint);
  const solids = toNonNegative(solidsBbl, 'solidsBbl');
  return {
    api: band.api,
    cutMicrons: band.midpoint,
    removalShare: round(share, 3),
    removedBbl: round(solids * share, 2),
    passedBbl: round(solids * (1 - share), 2),
    passedDistribution: passedDistribution(distribution, band.midpoint),
  };
}

/**
 * Compare a set of screens over the same solids.
 */
export function compareScreens({ apiNumbers, distribution, solidsBbl }) {
  return apiNumbers
    .map((apiNumber) => screenPerformance({ apiNumber, distribution, solidsBbl }))
    .sort((a, b) => b.removalShare - a.removalShare);
}
