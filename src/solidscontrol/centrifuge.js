/**
 * Centrifuge mass balance.
 *
 * A decanting centrifuge takes a feed and splits it two ways. The underflow is
 * the cake off the bowl wall, which on a weighted mud is nearly all barite and
 * goes back in the pits. The overflow is the effluent, which carries the fine
 * drilled solids and the liquid, and on a weighted mud it is thrown away.
 *
 * The whole thing is two equations: volume in equals volume out, and weight in
 * equals weight out. Everything the machine is judged on falls out of those.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { WATER_PPG } from '../units/density.js';
import { POUNDS_PER_BARREL_WATER, BARITE_SG, LOW_GRAVITY_SG } from '../solids/analysis.js';

/**
 * Split a feed between underflow and overflow from the three densities.
 */
export function split({ feedGpm, feedPpg, underflowPpg, overflowPpg }) {
  const feed = toPositive(feedGpm, 'feedGpm');
  const inWeight = toPositive(feedPpg, 'feedPpg');
  const under = toPositive(underflowPpg, 'underflowPpg');
  const over = toPositive(overflowPpg, 'overflowPpg');
  if (under <= over) {
    throw new Error(`the underflow at ${under} is not heavier than the overflow at ${over}`);
  }
  if (inWeight < over || inWeight > under) {
    throw new Error(`a ${inWeight} pound feed cannot split into ${over} and ${under}`);
  }
  const underflow = (feed * (inWeight - over)) / (under - over);
  return {
    underflowGpm: round(underflow, 2),
    overflowGpm: round(feed - underflow, 2),
    underflowShare: round(underflow / feed, 3),
  };
}

/**
 * Dilution water added to the feed to thin it enough for the bowl.
 */
export function dilutedFeed({ mudGpm, mudPpg, waterGpm, waterPpg = WATER_PPG }) {
  const mud = toPositive(mudGpm, 'mudGpm');
  const weight = toPositive(mudPpg, 'mudPpg');
  const water = toNonNegative(waterGpm, 'waterGpm');
  const dilutant = toPositive(waterPpg, 'waterPpg');
  const total = mud + water;
  return {
    feedGpm: round(total, 2),
    feedPpg: round((mud * weight + water * dilutant) / total, 2),
  };
}

/**
 * Solids in a stream, in pounds an hour, from its density and an assumed
 * average gravity for what it is carrying.
 */
export function solidsRate({ gpm, ppg, solidsSg, liquidPpg = WATER_PPG }) {
  const rate = toNonNegative(gpm, 'gpm');
  const weight = toPositive(ppg, 'ppg');
  const sg = toPositive(solidsSg, 'solidsSg');
  const liquid = toPositive(liquidPpg, 'liquidPpg');
  const solidPpg = sg * WATER_PPG;
  if (solidPpg <= liquid) {
    throw new Error('the solids are not heavier than the liquid carrying them');
  }
  const fraction = (weight - liquid) / (solidPpg - liquid);
  const barrelsPerHour = (rate * 60) / 42;
  return {
    volumeFraction: round(fraction, 4),
    solidsBblPerHour: round(barrelsPerHour * fraction, 2),
    solidsPoundsPerHour: round(barrelsPerHour * fraction * POUNDS_PER_BARREL_WATER * sg, 0),
  };
}

/**
 * The whole machine over an hour.
 */
export function centrifugeRun({
  mudGpm,
  mudPpg,
  waterGpm = 0,
  underflowPpg,
  overflowPpg,
  hours = 1,
}) {
  const feed = dilutedFeed({ mudGpm, mudPpg, waterGpm });
  const streams = split({
    feedGpm: feed.feedGpm,
    feedPpg: feed.feedPpg,
    underflowPpg,
    overflowPpg,
  });
  const recovered = solidsRate({
    gpm: streams.underflowGpm,
    ppg: underflowPpg,
    solidsSg: BARITE_SG,
  });
  const discarded = solidsRate({
    gpm: streams.overflowGpm,
    ppg: overflowPpg,
    solidsSg: LOW_GRAVITY_SG,
  });
  const run = toPositive(hours, 'hours');
  return {
    feedGpm: feed.feedGpm,
    feedPpg: feed.feedPpg,
    ...streams,
    bariteRecoveredPounds: round(recovered.solidsPoundsPerHour * run, 0),
    bariteRecoveredBbl: round(recovered.solidsBblPerHour * run, 2),
    solidsDiscardedPounds: round(discarded.solidsPoundsPerHour * run, 0),
    liquidDiscardedBbl: round(
      ((streams.overflowGpm * 60) / 42) * run * (1 - discarded.volumeFraction),
      2
    ),
  };
}

/**
 * What the machine is worth over a run, against the barite it saves and the
 * mud it throws away.
 */
export function centrifugeValue({
  run,
  baritePricePerPound,
  mudCostPerBbl,
  runningCostPerHour,
  hours,
}) {
  const barite = toNonNegative(run.bariteRecoveredPounds, 'bariteRecoveredPounds');
  const liquid = toNonNegative(run.liquidDiscardedBbl, 'liquidDiscardedBbl');
  const price = toNonNegative(baritePricePerPound, 'baritePricePerPound');
  const mud = toNonNegative(mudCostPerBbl, 'mudCostPerBbl');
  const running = toNonNegative(runningCostPerHour, 'runningCostPerHour');
  const worked = toPositive(hours, 'hours');
  const saved = barite * price;
  const lost = liquid * mud + running * worked;
  return {
    bariteSaved: round(saved, 2),
    mudAndRunningCost: round(lost, 2),
    netValue: round(saved - lost, 2),
    worthRunning: saved > lost,
  };
}
