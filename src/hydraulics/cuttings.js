/**
 * Whether the hole is being cleaned.
 *
 * A cutting falls through the mud at its slip velocity while the mud carries
 * it up at the annular velocity. The difference is what actually leaves the
 * hole. Moore's correlation gives the slip velocity and it needs the particle
 * Reynolds number, which needs the slip velocity, so it is solved by walking
 * the three regimes rather than in one pass.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { readAnnulus } from '../well/annulus-check.js';

/** Specific gravity taken for a drilled cutting. */
export const CUTTINGS_SG = 2.6;

/** Pounds a gallon for that gravity. */
export const CUTTINGS_PPG = CUTTINGS_SG * 8.3454;

/**
 * Moore's laminar constant.
 *
 * It is published as 82.87 with the viscosity in poise. Every other viscosity
 * on this desk is in centipoise, so the constant carries the hundred and the
 * argument stays in the unit the rest of the code uses. Reading the published
 * figure with centipoise puts the slip velocity a hundred times low, which
 * makes a hole that is packing off look like it is cleaning perfectly.
 */
export const MOORE_LAMINAR = 8287;

/** Moore's intermediate constant, with viscosity in centipoise. */
export const MOORE_INTERMEDIATE = 174;

/** Moore's turbulent constant, which needs no viscosity at all. */
export const MOORE_TURBULENT = 113.4;

/**
 * Apparent viscosity of the mud in the annulus, in centipoise.
 *
 * This is the API annular form, worked at the shear rate the flow is actually
 * at rather than at any one dial speed.
 */
export function annularApparentViscosity({
  model,
  velocityFeetPerMinute,
  holeIdInches,
  pipeOdInches,
}) {
  const n = toPositive(model?.n, 'n');
  const k = toPositive(model?.k, 'k');
  const velocity = toPositive(velocityFeetPerMinute, 'velocityFeetPerMinute');
  const { gap } = readAnnulus(holeIdInches, pipeOdInches);
  // K here is in pounds force per hundred square feet times seconds to the n,
  // and the form wants equivalent centipoise, so the 478.8 goes in with it.
  const consistency = k * 478.8;
  return (consistency / 144) * (gap / (velocity / 60)) ** (1 - n) * ((2 + 1 / n) / 0.0208) ** n;
}

/**
 * Slip velocity of one cutting, feet a minute.
 */
export function slipVelocity({
  cuttingDiameterInches,
  mudWeightPpg,
  apparentViscosityCp,
  cuttingsPpg = CUTTINGS_PPG,
}) {
  const size = toPositive(cuttingDiameterInches, 'cuttingDiameterInches');
  const mud = toPositive(mudWeightPpg, 'mudWeightPpg');
  const viscosity = toPositive(apparentViscosityCp, 'apparentViscosityCp');
  const difference = toPositive(cuttingsPpg, 'cuttingsPpg') - mud;
  if (difference <= 0) {
    return { velocityFeetPerMinute: 0, regime: 'floating', particleReynolds: 0 };
  }
  const laminar = (MOORE_LAMINAR * size * size * difference) / viscosity;
  const intermediate =
    (MOORE_INTERMEDIATE * size * difference ** 0.667) / (mud ** 0.333 * viscosity ** 0.333);
  const turbulent = MOORE_TURBULENT * Math.sqrt((size * difference) / mud);
  const reynoldsOf = (velocity) => (15.467 * mud * velocity * size) / viscosity;

  const laminarReynolds = reynoldsOf(laminar);
  if (laminarReynolds < 3) {
    return {
      velocityFeetPerMinute: laminar,
      regime: 'laminar',
      particleReynolds: laminarReynolds,
    };
  }
  const intermediateReynolds = reynoldsOf(intermediate);
  if (intermediateReynolds <= 300) {
    return {
      velocityFeetPerMinute: intermediate,
      regime: 'intermediate',
      particleReynolds: intermediateReynolds,
    };
  }
  return {
    velocityFeetPerMinute: turbulent,
    regime: 'turbulent',
    particleReynolds: reynoldsOf(turbulent),
  };
}

/**
 * The share of the annular velocity that actually moves cuttings.
 *
 * Below about half, the hole is filling up faster than it is emptying however
 * good the numbers on the rest of the sheet look.
 */
export function transportRatio(annularVelocityFeetPerMinute, slipVelocityFeetPerMinute) {
  const up = toPositive(annularVelocityFeetPerMinute, 'annularVelocityFeetPerMinute');
  const down = toNonNegative(slipVelocityFeetPerMinute, 'slipVelocityFeetPerMinute');
  return Math.max(0, (up - down) / up);
}

/**
 * Concentration of cuttings in the annulus as a volume percent.
 */
export function cuttingsConcentration({
  penetrationFeetPerHour,
  bitDiameterInches,
  flowGpm,
  transportRatio: ratio,
}) {
  const rate = toNonNegative(penetrationFeetPerHour, 'penetrationFeetPerHour');
  const bit = toPositive(bitDiameterInches, 'bitDiameterInches');
  const flow = toPositive(flowGpm, 'flowGpm');
  const share = toPositive(ratio, 'transportRatio');
  const cuttingsGpm = ((Math.PI / 4) * bit * bit * (rate / 60) * 12) / 231;
  return (cuttingsGpm / (flow * share)) * 100;
}

/**
 * The hole cleaning block of the hydraulics sheet.
 */
export function holeCleaning({
  model,
  annularVelocityFeetPerMinute,
  holeIdInches,
  pipeOdInches,
  mudWeightPpg,
  cuttingDiameterInches = 0.25,
  penetrationFeetPerHour = 0,
  bitDiameterInches = null,
  flowGpm = null,
}) {
  const viscosity = annularApparentViscosity({
    model,
    velocityFeetPerMinute: annularVelocityFeetPerMinute,
    holeIdInches,
    pipeOdInches,
  });
  const slip = slipVelocity({
    cuttingDiameterInches,
    mudWeightPpg,
    apparentViscosityCp: viscosity,
  });
  const ratio = transportRatio(annularVelocityFeetPerMinute, slip.velocityFeetPerMinute);
  const concentration =
    bitDiameterInches && flowGpm && ratio > 0
      ? cuttingsConcentration({
          penetrationFeetPerHour,
          bitDiameterInches,
          flowGpm,
          transportRatio: ratio,
        })
      : null;
  return {
    apparentViscosityCp: round(viscosity, 1),
    slipVelocityFeetPerMinute: round(slip.velocityFeetPerMinute, 1),
    slipRegime: slip.regime,
    particleReynolds: round(slip.particleReynolds, 2),
    transportRatio: round(ratio, 3),
    cuttingsConcentrationPercent: concentration === null ? null : round(concentration, 2),
    cleaning: ratio >= 0.5,
  };
}
