/**
 * The kill sheet.
 *
 * Not the whole of well control, which is the driller's business, but the mud
 * side of it: what the mud has to weigh, what the standpipe should read on the
 * way down, and how much pressure the shoe will take before the well is broken
 * down at the same time as it is being killed.
 *
 * The step down schedule is worked in strokes rather than in minutes because
 * the pump rate on a kill is slow and it drifts.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { GRADIENT_PER_PPG } from '../units/density.js';

/**
 * The mud weight that balances the shut in drill pipe pressure.
 */
export function killMudWeight({ currentPpg, shutInDrillPipePsi, tvdFeet }) {
  const current = toPositive(currentPpg, 'currentPpg');
  const pressure = toNonNegative(shutInDrillPipePsi, 'shutInDrillPipePsi');
  const depth = toPositive(tvdFeet, 'tvdFeet');
  return round(current + pressure / (GRADIENT_PER_PPG * depth), 2);
}

/**
 * Standpipe pressure at the start and at the end of the kill.
 */
export function circulatingPressures({ shutInDrillPipePsi, slowPumpPsi, currentPpg, killPpg }) {
  const slow = toNonNegative(slowPumpPsi, 'slowPumpPsi');
  const initial = toNonNegative(shutInDrillPipePsi, 'shutInDrillPipePsi') + slow;
  const final = (slow * toPositive(killPpg, 'killPpg')) / toPositive(currentPpg, 'currentPpg');
  return {
    initialPsi: round(initial, 0),
    finalPsi: round(final, 0),
    slowPumpPsi: round(slow, 0),
  };
}

/**
 * The step down schedule, one row for each share of the string displaced.
 */
export function stepDown({ initialPsi, finalPsi, stringStrokes, steps = 10 }) {
  const start = toNonNegative(initialPsi, 'initialPsi');
  const end = toNonNegative(finalPsi, 'finalPsi');
  const strokes = toPositive(stringStrokes, 'stringStrokes');
  const count = toPositive(steps, 'steps');
  if (!Number.isInteger(count)) {
    throw new Error('the schedule needs a whole number of steps');
  }
  const rows = [];
  for (let i = 0; i <= count; i += 1) {
    const share = i / count;
    rows.push({
      strokes: Math.round(strokes * share),
      share: round(share, 3),
      standpipePsi: round(start + (end - start) * share, 0),
    });
  }
  return rows;
}

/**
 * The most the annulus can be pressured up at surface before the shoe goes.
 */
export function maximumAnnularPressure({ leakOffPpg, mudPpg, shoeTvdFeet }) {
  const leakOff = toPositive(leakOffPpg, 'leakOffPpg');
  const mud = toPositive(mudPpg, 'mudPpg');
  const shoe = toPositive(shoeTvdFeet, 'shoeTvdFeet');
  if (mud >= leakOff) {
    return { psi: 0, alreadyOver: true };
  }
  return {
    psi: round(GRADIENT_PER_PPG * (leakOff - mud) * shoe, 0),
    alreadyOver: false,
  };
}

/**
 * What the influx is, from the pit gain and the pressure difference.
 *
 * The gradient of what came in says whether it is gas, oil or salt water, and
 * that changes everything about how the kill is run.
 */
export function influxGradient({
  gainBbl,
  shutInDrillPipePsi,
  shutInCasingPsi,
  annularCapacityBblPerFoot,
  mudPpg,
}) {
  const gain = toPositive(gainBbl, 'gainBbl');
  const capacity = toPositive(annularCapacityBblPerFoot, 'annularCapacityBblPerFoot');
  const drillPipe = toNonNegative(shutInDrillPipePsi, 'shutInDrillPipePsi');
  const casing = toNonNegative(shutInCasingPsi, 'shutInCasingPsi');
  const mud = toPositive(mudPpg, 'mudPpg');
  const height = gain / capacity;
  const gradient = GRADIENT_PER_PPG * mud - (casing - drillPipe) / height;
  let kind = 'salt water';
  if (gradient < 0.15) {
    kind = 'gas';
  } else if (gradient < 0.35) {
    kind = 'oil';
  }
  return {
    heightFeet: round(height, 0),
    gradientPsiPerFoot: round(gradient, 3),
    kind,
  };
}

/**
 * The whole sheet.
 */
export function killSheet({
  currentPpg,
  shutInDrillPipePsi,
  shutInCasingPsi,
  tvdFeet,
  slowPumpPsi,
  stringStrokes,
  gainBbl,
  annularCapacityBblPerFoot,
  leakOffPpg,
  shoeTvdFeet,
  steps = 10,
}) {
  const kill = killMudWeight({ currentPpg, shutInDrillPipePsi, tvdFeet });
  const pressures = circulatingPressures({
    shutInDrillPipePsi,
    slowPumpPsi,
    currentPpg,
    killPpg: kill,
  });
  return {
    currentPpg,
    killPpg: kill,
    weightUpPpg: round(kill - currentPpg, 2),
    ...pressures,
    schedule: stepDown({
      initialPsi: pressures.initialPsi,
      finalPsi: pressures.finalPsi,
      stringStrokes,
      steps,
    }),
    maximumAnnular: maximumAnnularPressure({ leakOffPpg, mudPpg: currentPpg, shoeTvdFeet }),
    influx: influxGradient({
      gainBbl,
      shutInDrillPipePsi,
      shutInCasingPsi,
      annularCapacityBblPerFoot,
      mudPpg: currentPpg,
    }),
  };
}
