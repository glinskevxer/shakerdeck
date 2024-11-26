/**
 * Choosing nozzles.
 *
 * Two criteria, and they do not agree. Maximum hydraulic horsepower at the bit
 * wants about two thirds of the pump pressure spent across the nozzles.
 * Maximum jet impact force wants about half. Which one is right depends on the
 * hole: horsepower cleans the cutting structure and impact force cleans the
 * bottom of the hole, and in a soft formation that balls up it is the second
 * one that matters.
 *
 * Both fall out of the same observation: the parasitic losses go up as roughly
 * the rate to the power 1.86, and everything left over is available at the bit.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { systemPressure } from './system.js';
import { totalFlowArea, bitPressureDrop, DISCHARGE_COEFFICIENT, BIT_LOSS_CONSTANT } from './bit.js';

/** How the parasitic losses grow with rate. */
export const PARASITIC_EXPONENT = 1.86;

/** The share of the pump pressure each criterion wants across the bit. */
export const OPTIMUM_SHARE = {
  horsepower: PARASITIC_EXPONENT / (PARASITIC_EXPONENT + 1),
  'impact force': PARASITIC_EXPONENT / (PARASITIC_EXPONENT + 2),
};

/**
 * Fit the parasitic loss curve through one measured point.
 *
 * The losses at any other rate follow from the exponent, which saves running
 * the whole pressure loss chain at every candidate rate.
 */
export function fitParasitic({ referenceGpm, referencePsi }) {
  const rate = toPositive(referenceGpm, 'referenceGpm');
  const loss = toPositive(referencePsi, 'referencePsi');
  return { coefficient: loss / rate ** PARASITIC_EXPONENT, exponent: PARASITIC_EXPONENT };
}

/**
 * Parasitic loss the fit predicts at a rate.
 */
export function parasiticAt(fit, flowGpm) {
  return fit.coefficient * toNonNegative(flowGpm, 'flowGpm') ** fit.exponent;
}

/**
 * The rate and the bit drop that satisfy a criterion at a pressure limit.
 */
export function optimumRate({ fit, maximumPsi, criterion = 'horsepower', maximumGpm = 1200 }) {
  const share = OPTIMUM_SHARE[criterion];
  if (share === undefined) {
    throw new Error(`there is no criterion called ${criterion}`);
  }
  const limit = toPositive(maximumPsi, 'maximumPsi');
  const wantedParasitic = limit * (1 - share);
  const rate = (wantedParasitic / fit.coefficient) ** (1 / fit.exponent);
  const capped = Math.min(rate, toPositive(maximumGpm, 'maximumGpm'));
  const parasitic = parasiticAt(fit, capped);
  return {
    criterion,
    share: round(share, 3),
    flowGpm: round(capped, 0),
    parasiticPsi: round(parasitic, 0),
    bitPsi: round(limit - parasitic, 0),
    rateLimited: capped < rate,
  };
}

/**
 * The nozzle area that produces a wanted bit drop at a rate.
 */
export function areaForDrop({
  bitPsi,
  flowGpm,
  densityPpg,
  dischargeCoefficient = DISCHARGE_COEFFICIENT,
}) {
  const drop = toPositive(bitPsi, 'bitPsi');
  const flow = toPositive(flowGpm, 'flowGpm');
  const density = toPositive(densityPpg, 'densityPpg');
  const cd = toPositive(dischargeCoefficient, 'dischargeCoefficient');
  return Math.sqrt((BIT_LOSS_CONSTANT * density * flow * flow) / (cd * cd * drop));
}

/**
 * The nozzle set closest to a wanted area, in thirty seconds of an inch.
 *
 * Nozzles come in whole thirty seconds and a bit takes three of them, so the
 * answer is always a compromise. The set that is slightly small is preferred
 * over the set that is slightly large, because a bit that is a little tight
 * loses rate and a bit that is a little open loses the whole criterion.
 */
export function nozzleSetFor({ areaSquareInches, count = 3, smallest = 8, largest = 24 }) {
  const wanted = toPositive(areaSquareInches, 'areaSquareInches');
  let best = null;
  for (let size = smallest; size <= largest; size += 1) {
    for (let odd = 0; odd <= 1; odd += 1) {
      const sizes = Array.from({ length: count }, (_, index) =>
        index === 0 && odd === 1 ? size + 1 : size
      );
      const area = totalFlowArea(sizes);
      const miss = area - wanted;
      const score = miss <= 0 ? -miss : miss * 1.5;
      if (best === null || score < best.score) {
        best = { sizes, area, score, miss };
      }
    }
  }
  return {
    nozzles: best.sizes,
    totalFlowArea: round(best.area, 4),
    wantedArea: round(wanted, 4),
    missSquareInches: round(best.miss, 4),
  };
}

/**
 * Both criteria worked out against one well.
 */
export function optimiseBit({ well, dials, referenceGpm, maximumPsi }) {
  const reference = systemPressure({ ...well, dials, flowGpm: referenceGpm });
  const fit = fitParasitic({ referenceGpm, referencePsi: reference.parasiticPsi });
  return Object.keys(OPTIMUM_SHARE).map((criterion) => {
    const optimum = optimumRate({ fit, maximumPsi, criterion });
    const area = areaForDrop({
      bitPsi: optimum.bitPsi,
      flowGpm: optimum.flowGpm,
      densityPpg: well.densityPpg,
    });
    const set = nozzleSetFor({ areaSquareInches: area });
    return {
      ...optimum,
      ...set,
      actualBitPsi: round(
        bitPressureDrop({
          flowGpm: optimum.flowGpm,
          totalFlowAreaSquareInches: set.totalFlowArea,
          densityPpg: well.densityPpg,
        }),
        0
      ),
    };
  });
}
