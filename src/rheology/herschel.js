/**
 * The Herschel Bulkley model, which is a power law sitting on top of a yield
 * stress. Three constants instead of two, and it is the one the hydraulics
 * work uses when the low speed readings are there.
 *
 * A note on units, because the industry is inconsistent about them and this is
 * where it bites. A dial degree on the F1 spring is 1.0678 pounds force per
 * hundred square feet, but the yield point on every daily report is quoted
 * straight off the dial as though the factor were one. This module works in
 * real stress and applies the factor. The Bingham yield point next door does
 * not, because the number on the report has to match the number the company
 * man works out on the back of the tour sheet.
 */
import { toPositive, round } from '../util/number.js';
import { dialAt, shearRate, shearStress, STRESS_PER_DIAL } from './dial.js';

/**
 * Low shear yield point in dial units: twice the three reading less the six.
 * This is the number that predicts whether cuttings stay up in a wide annulus,
 * and it is the one that moves when the mud is treated for hole cleaning.
 */
export function lowShearYieldPoint(readings) {
  return 2 * dialAt(readings, 3) - dialAt(readings, 6);
}

/**
 * Fit the three constants.
 *
 * The yield stress comes off the two low speed readings, and the curve above
 * it is fitted through the six hundred and three hundred pair with that stress
 * taken out first.
 */
export function herschelFit(readings) {
  const yieldDial = lowShearYieldPoint(readings);
  const six = dialAt(readings, 600);
  const three = dialAt(readings, 300);
  const aboveFast = six - yieldDial;
  const aboveSlow = three - yieldDial;
  if (aboveSlow <= 0 || aboveFast <= 0) {
    throw new Error(
      `the yield stress of ${yieldDial} is at or above the ${three} reading at 300 rpm`
    );
  }
  const fastRate = shearRate(600);
  const slowRate = shearRate(300);
  const n = Math.log(aboveFast / aboveSlow) / Math.log(fastRate / slowRate);
  const k = (aboveSlow * STRESS_PER_DIAL) / slowRate ** n;
  return {
    tauZero: yieldDial * STRESS_PER_DIAL,
    tauZeroDial: yieldDial,
    n,
    k,
  };
}

/**
 * Shear stress the fit predicts, lbf per hundred square feet.
 */
export function stressAt(fit, shearRatePerSecond) {
  const rate = toPositive(shearRatePerSecond, 'shearRatePerSecond');
  return fit.tauZero + fit.k * rate ** fit.n;
}

/**
 * Viscosity the fit predicts, in centipoise.
 */
export function viscosityAt(fit, shearRatePerSecond) {
  const rate = toPositive(shearRatePerSecond, 'shearRatePerSecond');
  return (47880 * stressAt(fit, rate)) / (100 * rate);
}

/**
 * How far each measured point sits from the fitted curve, in dial degrees.
 * A fit that is out by more than a degree at any speed is worth looking at
 * before the hydraulics are run off it.
 */
export function residuals(readings, fit = null) {
  const model = fit ?? herschelFit(readings);
  const rows = [];
  for (const rpm of [600, 300, 200, 100, 6, 3]) {
    let dial;
    try {
      dial = dialAt(readings, rpm);
    } catch {
      continue;
    }
    const predicted = stressAt(model, shearRate(rpm));
    rows.push({
      rpm,
      dial,
      measured: round(shearStress(dial), 3),
      predicted: round(predicted, 3),
      errorDial: round(predicted / STRESS_PER_DIAL - dial, 2),
    });
  }
  return rows;
}

/**
 * The largest absolute error over the readings, in dial degrees.
 */
export function worstError(readings, fit = null) {
  const rows = residuals(readings, fit);
  return rows.reduce((worst, row) => Math.max(worst, Math.abs(row.errorDial)), 0);
}

/**
 * The block the rheology page prints for this model.
 */
export function herschelSummary(readings) {
  const fit = herschelFit(readings);
  return {
    lowShearYieldPoint: round(lowShearYieldPoint(readings), 2),
    tauZero: round(fit.tauZero, 3),
    n: round(fit.n, 4),
    k: round(fit.k, 4),
    worstErrorDial: round(worstError(readings, fit), 2),
  };
}
