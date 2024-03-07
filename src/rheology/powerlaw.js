/**
 * The power law model.
 *
 * Two constants, a flow behaviour index and a consistency index, fitted
 * through any two points on the flow curve. It follows a real mud far better
 * than a straight line does, and the pair it is fitted through matters: the
 * six hundred and three hundred pair describes the mud inside the pipe, and
 * the hundred and three pair describes it out in the annulus where the shear
 * rate is an order of magnitude lower.
 */
import { toPositive, round } from '../util/number.js';
import { dialAt, shearRate, shearStress } from './dial.js';

/**
 * Fit the model through two speeds.
 *
 * Returns the index n, which has no units, and the consistency K in pounds
 * force per hundred square feet times seconds to the n.
 */
export function powerLawFrom(readings, fastRpm, slowRpm) {
  const fast = toPositive(fastRpm, 'fastRpm');
  const slow = toPositive(slowRpm, 'slowRpm');
  if (fast <= slow) {
    throw new Error(`${fast} rpm is not faster than ${slow} rpm`);
  }
  const fastDial = dialAt(readings, fast);
  const slowDial = dialAt(readings, slow);
  if (slowDial <= 0) {
    throw new Error(`the reading at ${slow} rpm is zero, the model cannot be fitted through it`);
  }
  if (fastDial <= 0) {
    throw new Error(`the reading at ${fast} rpm is zero, the model cannot be fitted through it`);
  }
  const fastRate = shearRate(fast);
  const slowRate = shearRate(slow);
  const n = Math.log(fastDial / slowDial) / Math.log(fastRate / slowRate);
  const k = shearStress(slowDial) / slowRate ** n;
  return { n, k, throughRpm: [fast, slow] };
}

/**
 * The pipe pair, which is what the standpipe pressure is worked from.
 */
export function pipeModel(readings) {
  return powerLawFrom(readings, 600, 300);
}

/**
 * The annular pair. A mud that looks the same at six hundred can behave very
 * differently down here, and this is the fit that decides hole cleaning.
 */
export function annularModel(readings) {
  return powerLawFrom(readings, 100, 3);
}

/**
 * Shear stress the fit predicts at a shear rate, lbf per hundred square feet.
 */
export function stressAt(model, shearRatePerSecond) {
  const rate = toPositive(shearRatePerSecond, 'shearRatePerSecond');
  return model.k * rate ** model.n;
}

/**
 * Viscosity the fit predicts at a shear rate, in centipoise.
 */
export function viscosityAt(model, shearRatePerSecond) {
  const rate = toPositive(shearRatePerSecond, 'shearRatePerSecond');
  return (47880 * stressAt(model, rate)) / (100 * rate);
}

/**
 * How shear thinning the mud is, in words a report can print.
 *
 * An index at one is a fluid whose viscosity does not change with shear at
 * all. The further below one it sits the more the mud thins under the bit and
 * thickens again out in the annulus, which is the behaviour that is wanted.
 */
export function describeIndex(n) {
  if (n >= 1) {
    return 'newtonian or thickening';
  }
  if (n >= 0.8) {
    return 'barely shear thinning';
  }
  if (n >= 0.6) {
    return 'moderately shear thinning';
  }
  if (n >= 0.4) {
    return 'strongly shear thinning';
  }
  return 'very strongly shear thinning';
}

/**
 * Both fits side by side, which is how the rheology page of the report reads.
 */
export function powerLawSummary(readings) {
  const pipe = pipeModel(readings);
  const annulus = annularModel(readings);
  return {
    pipeN: round(pipe.n, 4),
    pipeK: round(pipe.k, 4),
    annularN: round(annulus.n, 4),
    annularK: round(annulus.k, 4),
    character: describeIndex(annulus.n),
  };
}
