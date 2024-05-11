/**
 * Bit hydraulics.
 *
 * Nozzles are ordered and fitted in thirty seconds of an inch, so that is what
 * the sizes are given in. Everything else here follows from the total flow
 * area they add up to.
 *
 * The two numbers that get argued about are the horsepower per square inch of
 * hole and the impact force. They optimise to different nozzle sizes and the
 * desk prints both rather than picking a side.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/** Discharge coefficient of a drilled nozzle. */
export const DISCHARGE_COEFFICIENT = 0.95;

/** Pressure drop form constant for pounds a gallon, gallons a minute, square inches. */
export const BIT_LOSS_CONSTANT = 8.311e-5;

/**
 * Total flow area of a set of nozzles, in square inches.
 */
export function totalFlowArea(nozzleThirtySeconds) {
  if (!Array.isArray(nozzleThirtySeconds) || nozzleThirtySeconds.length === 0) {
    throw new Error('a bit needs at least one nozzle');
  }
  return nozzleThirtySeconds.reduce((total, size, index) => {
    const diameter = toPositive(size, `nozzle ${index + 1}`) / 32;
    return total + (Math.PI / 4) * diameter * diameter;
  }, 0);
}

/**
 * Pressure drop across the bit.
 */
export function bitPressureDrop({
  flowGpm,
  totalFlowAreaSquareInches,
  densityPpg,
  dischargeCoefficient = DISCHARGE_COEFFICIENT,
}) {
  const flow = toNonNegative(flowGpm, 'flowGpm');
  const area = toPositive(totalFlowAreaSquareInches, 'totalFlowAreaSquareInches');
  const density = toPositive(densityPpg, 'densityPpg');
  const cd = toPositive(dischargeCoefficient, 'dischargeCoefficient');
  return (BIT_LOSS_CONSTANT * density * flow * flow) / (cd * cd * area * area);
}

/**
 * Velocity out of the nozzles, feet a second.
 */
export function nozzleVelocity(flowGpm, totalFlowAreaSquareInches) {
  const area = toPositive(totalFlowAreaSquareInches, 'totalFlowAreaSquareInches');
  return toNonNegative(flowGpm, 'flowGpm') / (3.117 * area);
}

/**
 * Hydraulic horsepower for a pressure and a rate.
 */
export function hydraulicHorsepower(pressurePsi, flowGpm) {
  return (toNonNegative(pressurePsi, 'pressurePsi') * toNonNegative(flowGpm, 'flowGpm')) / 1714;
}

/**
 * Horsepower per square inch of hole bottom, which is the number a bit
 * programme is written against.
 */
export function horsepowerPerSquareInch(horsepower, bitDiameterInches) {
  const bit = toPositive(bitDiameterInches, 'bitDiameterInches');
  const area = (Math.PI / 4) * bit * bit;
  return toNonNegative(horsepower, 'horsepower') / area;
}

/**
 * Force the jets land on the bottom of the hole, in pounds force.
 */
export function jetImpactForce({
  flowGpm,
  densityPpg,
  pressureDropPsi,
  dischargeCoefficient = DISCHARGE_COEFFICIENT,
}) {
  const flow = toNonNegative(flowGpm, 'flowGpm');
  const density = toPositive(densityPpg, 'densityPpg');
  const drop = toNonNegative(pressureDropPsi, 'pressureDropPsi');
  return (
    0.01823 *
    toPositive(dischargeCoefficient, 'dischargeCoefficient') *
    flow *
    Math.sqrt(density * drop)
  );
}

/**
 * The bit block of the hydraulics sheet.
 */
export function bitSummary({
  nozzleThirtySeconds,
  flowGpm,
  densityPpg,
  bitDiameterInches,
  systemPressurePsi = null,
  dischargeCoefficient = DISCHARGE_COEFFICIENT,
}) {
  const area = totalFlowArea(nozzleThirtySeconds);
  const drop = bitPressureDrop({
    flowGpm,
    totalFlowAreaSquareInches: area,
    densityPpg,
    dischargeCoefficient,
  });
  const horsepower = hydraulicHorsepower(drop, flowGpm);
  return {
    nozzles: [...nozzleThirtySeconds],
    totalFlowArea: round(area, 4),
    pressureDropPsi: round(drop, 0),
    nozzleVelocityFeetPerSecond: round(nozzleVelocity(flowGpm, area), 0),
    hydraulicHorsepower: round(horsepower, 1),
    horsepowerPerSquareInch: round(horsepowerPerSquareInch(horsepower, bitDiameterInches), 2),
    jetImpactForceLbf: round(
      jetImpactForce({ flowGpm, densityPpg, pressureDropPsi: drop, dischargeCoefficient }),
      0
    ),
    shareOfSystem:
      systemPressurePsi === null
        ? null
        : round(drop / toPositive(systemPressurePsi, 'systemPressurePsi'), 3),
  };
}
