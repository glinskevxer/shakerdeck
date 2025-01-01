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
  // A gradient below zero is not a light influx, it is a set of readings that
  // do not go together: the difference between the two gauges is more than the
  // mud in the same height of annulus weighs. Reporting it as gas is worse
  // than reporting nothing, because it reads as an answer.
  if (gradient < 0) {
    return {
      heightFeet: round(height, 0),
      gradientPsiPerFoot: round(gradient, 3),
      kind: 'the readings do not go together',
      impossible: true,
    };
  }
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
    impossible: false,
  };
}

/**
 * Cross checks on the readings before anything is worked out from them.
 *
 * None of these stop the sheet being produced. They go on the page beside it,
 * because a sheet that quietly works out a kill weight from a casing gauge
 * that is reading low is worse than one that says the gauge is wrong.
 */
export function sheetChecks({
  currentPpg,
  shutInDrillPipePsi,
  shutInCasingPsi,
  killPpg,
  leakOffPpg,
  influx,
}) {
  const notes = [];
  if (shutInCasingPsi < shutInDrillPipePsi) {
    notes.push(
      `the casing gauge reads ${shutInCasingPsi} against ${shutInDrillPipePsi} on the drill pipe, which is the wrong way round for an influx in the annulus`
    );
  }
  if (influx?.impossible) {
    notes.push(
      'the difference between the two gauges is more than the mud in that height of annulus weighs, so one of the gain and the two pressures is wrong'
    );
  }
  if (leakOffPpg !== undefined && killPpg >= leakOffPpg) {
    notes.push(
      `the kill weight of ${killPpg} is at or over the leak off of ${leakOffPpg}, so the shoe goes before the well is dead`
    );
  }
  if (killPpg - currentPpg > 2) {
    notes.push(
      `a weight up of ${round(killPpg - currentPpg, 2)} pounds is a long way in one step, check the drill pipe gauge`
    );
  }
  return { notes, clean: notes.length === 0 };
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
  const influx = influxGradient({
    gainBbl,
    shutInDrillPipePsi,
    shutInCasingPsi,
    annularCapacityBblPerFoot,
    mudPpg: currentPpg,
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
    influx,
    checks: sheetChecks({
      currentPpg,
      shutInDrillPipePsi,
      shutInCasingPsi,
      killPpg: kill,
      leakOffPpg,
      influx,
    }),
  };
}
