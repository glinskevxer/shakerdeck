/**
 * What the mud does when it gets hot.
 *
 * Every reading on the sheet is taken at whatever the sample was when it
 * reached the lab, which on a deep well is a hundred degrees cooler than the
 * bottom of the hole. Viscosity falls with temperature and it does not fall in
 * a straight line, so a hydraulics run off a surface reading understates the
 * standpipe pressure and overstates the hole cleaning at the same time.
 *
 * Two readings at two temperatures fit the exponential, which is enough to
 * carry a surface reading down the hole with a known error rather than none.
 */
import { toPositive, toNumber, round } from '../util/number.js';
import { fahrenheitToRankine } from '../units/measure.js';

/** Degrees fahrenheit the hole gains every hundred feet, in an average basin. */
export const TYPICAL_GRADIENT = 1.2;

/**
 * Bottom hole temperature from a surface temperature and a gradient.
 */
export function bottomHoleTemperature({
  surfaceF,
  tvdFeet,
  gradientPer100Feet = TYPICAL_GRADIENT,
}) {
  return (
    toNumber(surfaceF, 'surfaceF') +
    (toPositive(tvdFeet, 'tvdFeet') / 100) * toNumber(gradientPer100Feet, 'gradientPer100Feet')
  );
}

/**
 * Fit viscosity against temperature through two readings.
 *
 * The form is an arrhenius one: the logarithm of viscosity against the
 * reciprocal of absolute temperature is a straight line.
 */
export function fitTemperature({ coldF, coldViscosity, hotF, hotViscosity }) {
  const cold = fahrenheitToRankine(coldF);
  const hot = fahrenheitToRankine(hotF);
  if (cold === hot) {
    throw new Error('both readings were taken at the same temperature');
  }
  const coldValue = toPositive(coldViscosity, 'coldViscosity');
  const hotValue = toPositive(hotViscosity, 'hotViscosity');
  const slope = Math.log(hotValue / coldValue) / (1 / hot - 1 / cold);
  const intercept = Math.log(coldValue) - slope / cold;
  return { slope, intercept, throughF: [coldF, hotF] };
}

/**
 * Viscosity the fit predicts at a temperature.
 */
export function viscosityAt(fit, fahrenheit) {
  const absolute = fahrenheitToRankine(fahrenheit);
  return Math.exp(fit.intercept + fit.slope / absolute);
}

/**
 * Carry a surface reading down to the bottom of the hole.
 */
export function correctToDepth({ fit, surfaceF, tvdFeet, gradientPer100Feet = TYPICAL_GRADIENT }) {
  const bottom = bottomHoleTemperature({ surfaceF, tvdFeet, gradientPer100Feet });
  const atSurface = viscosityAt(fit, surfaceF);
  const atBottom = viscosityAt(fit, bottom);
  return {
    surfaceF: round(surfaceF, 1),
    bottomHoleF: round(bottom, 1),
    surfaceViscosity: round(atSurface, 2),
    bottomHoleViscosity: round(atBottom, 2),
    thinningShare: round(1 - atBottom / atSurface, 3),
  };
}

/**
 * How far out a hydraulics run off the surface reading is.
 *
 * Pressure loss goes roughly with viscosity to the power of one minus the flow
 * behaviour index, so a mud that halves in viscosity does not halve in
 * pressure loss. This puts a figure on it rather than leaving it as a feeling.
 */
export function pressureError({ thinningShare, flowIndex }) {
  const share = toNumber(thinningShare, 'thinningShare');
  const n = toPositive(flowIndex, 'flowIndex');
  if (share >= 1) {
    throw new Error('the mud cannot thin away to nothing');
  }
  const ratio = (1 - share) ** (1 - n);
  return {
    lossRatio: round(ratio, 3),
    overstatedShare: round(1 - ratio, 3),
  };
}

/**
 * The temperature block of the report.
 */
export function temperatureSummary({
  coldF,
  coldViscosity,
  hotF,
  hotViscosity,
  tvdFeet,
  gradientPer100Feet = TYPICAL_GRADIENT,
  flowIndex = null,
}) {
  const fit = fitTemperature({ coldF, coldViscosity, hotF, hotViscosity });
  const corrected = correctToDepth({ fit, surfaceF: coldF, tvdFeet, gradientPer100Feet });
  return {
    ...corrected,
    ...(flowIndex === null
      ? {}
      : pressureError({ thinningShare: corrected.thinningShare, flowIndex })),
  };
}
