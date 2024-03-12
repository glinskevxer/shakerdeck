/**
 * Which model to believe.
 *
 * All three fits are exact at the pair they were fitted through and none of
 * them is exact everywhere, so the desk scores each one over every reading
 * that was taken and prints the spread. On a mud with real low end structure
 * the straight line is out by ten dial degrees at three rpm, and that error
 * goes straight into the annular pressure loss if nobody looks.
 */
import { round } from '../util/number.js';
import { dialAt, shearRate, shearStress, STANDARD_SPEEDS, STRESS_PER_DIAL } from './dial.js';
import * as bingham from './bingham.js';
import * as powerlaw from './powerlaw.js';
import * as herschel from './herschel.js';

function readingsPresent(readings) {
  const rows = [];
  for (const rpm of STANDARD_SPEEDS) {
    try {
      rows.push({ rpm, dial: dialAt(readings, rpm) });
    } catch {
      continue;
    }
  }
  return rows;
}

/**
 * Score one predictor over every reading. The predictor takes a shear rate and
 * returns a stress in lbf per hundred square feet.
 */
export function scoreModel(readings, predict) {
  const rows = readingsPresent(readings);
  if (rows.length === 0) {
    throw new Error('there are no readings to score against');
  }
  let squared = 0;
  let worst = 0;
  let worstRpm = null;
  const errors = rows.map(({ rpm, dial }) => {
    const predicted = predict(shearRate(rpm));
    const error = predicted - shearStress(dial);
    squared += error * error;
    if (Math.abs(error) > Math.abs(worst)) {
      worst = error;
      worstRpm = rpm;
    }
    return { rpm, dial, errorDial: round(error / STRESS_PER_DIAL, 2) };
  });
  return {
    readings: rows.length,
    rootMeanSquare: round(Math.sqrt(squared / rows.length) / STRESS_PER_DIAL, 3),
    worstErrorDial: round(worst / STRESS_PER_DIAL, 2),
    worstAt: worstRpm,
    errors,
  };
}

/**
 * Score all three models against the same set of readings.
 */
export function compareModels(readings) {
  const binghamScore = scoreModel(
    readings,
    (rate) => bingham.stressAt(readings, rate) * STRESS_PER_DIAL
  );
  const pipe = powerlaw.pipeModel(readings);
  const powerScore = scoreModel(readings, (rate) => powerlaw.stressAt(pipe, rate));
  const rows = [
    { model: 'bingham', ...binghamScore },
    { model: 'power law', ...powerScore },
  ];
  try {
    const fit = herschel.herschelFit(readings);
    rows.push({
      model: 'herschel bulkley',
      ...scoreModel(readings, (rate) => herschel.stressAt(fit, rate)),
    });
  } catch {
    // A mud with no usable low end cannot carry the three constant fit. The
    // other two still stand and the comparison is still worth printing.
  }
  return rows;
}

/**
 * The model that follows the measured curve most closely.
 */
export function bestModel(readings) {
  const rows = compareModels(readings);
  return rows.reduce((best, row) => (row.rootMeanSquare < best.rootMeanSquare ? row : best));
}

/**
 * A one line verdict for the report.
 */
export function modelVerdict(readings) {
  const rows = compareModels(readings);
  const best = bestModel(readings);
  const straight = rows.find((row) => row.model === 'bingham');
  return {
    best: best.model,
    bestRootMeanSquare: best.rootMeanSquare,
    binghamWorstErrorDial: straight.worstErrorDial,
    binghamWorstAt: straight.worstAt,
    modelsScored: rows.length,
  };
}
