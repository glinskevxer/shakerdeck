/**
 * Losses, and what to do about them.
 *
 * The decision is made on how fast the mud is going away and where it is going,
 * and it is made badly at three in the morning by people who are tired. The
 * bands below are the ones the industry uses, and the point of writing them
 * down is that the treatment for a seepage loss and the treatment for a total
 * loss are not the same thing at a different concentration.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { lostCirculationPill } from '../material/pill.js';

/** Loss rates, in barrels an hour, and what each one is called. */
export const LOSS_BANDS = [
  { name: 'seepage', upTo: 10, grade: 'fine', concentrationLbBbl: 20 },
  { name: 'partial', upTo: 50, grade: 'medium', concentrationLbBbl: 30 },
  { name: 'severe', upTo: 150, grade: 'coarse', concentrationLbBbl: 50 },
  { name: 'total', upTo: Infinity, grade: 'high concentration', concentrationLbBbl: 80 },
];

/**
 * Which band a loss rate falls in.
 */
export function lossBand(barrelsPerHour) {
  const rate = toNonNegative(barrelsPerHour, 'barrelsPerHour');
  if (rate === 0) {
    return { name: 'none', upTo: 0, grade: null, concentrationLbBbl: 0 };
  }
  return LOSS_BANDS.find((band) => rate <= band.upTo);
}

/**
 * The first treatment for a loss, and the volume it needs.
 *
 * The pill is sized to the open hole it has to cover rather than to a round
 * number, because a pill that does not reach the loss zone treats nothing.
 */
export function firstTreatment({
  barrelsPerHour,
  annularCapacityBblPerFoot,
  coverFeet = 300,
  systemBbl,
}) {
  const band = lossBand(barrelsPerHour);
  if (band.name === 'none') {
    return { band, pill: null, action: 'nothing to treat' };
  }
  const capacity = toPositive(annularCapacityBblPerFoot, 'annularCapacityBblPerFoot');
  const volume = Math.max(20, capacity * toPositive(coverFeet, 'coverFeet'));
  const pill = lostCirculationPill({
    grade: band.grade,
    volumeBbl: volume,
    concentrationLbBbl: band.concentrationLbBbl,
  });
  return {
    band,
    pill,
    lostPerHourBbl: round(toNonNegative(barrelsPerHour, 'barrelsPerHour'), 1),
    hoursOfSystem:
      barrelsPerHour === 0 ? null : round(toPositive(systemBbl, 'systemBbl') / barrelsPerHour, 1),
    action:
      band.name === 'total'
        ? 'pull back, stop pumping and consider a cement plug'
        : `spot a ${pill.volumeBbl} barrel ${band.grade} pill across the loss zone`,
  };
}

/**
 * What the losses cost over the time they run for.
 */
export function lossCost({ barrelsPerHour, hours, mudCostPerBbl }) {
  const rate = toNonNegative(barrelsPerHour, 'barrelsPerHour');
  const run = toNonNegative(hours, 'hours');
  const cost = toNonNegative(mudCostPerBbl, 'mudCostPerBbl');
  return {
    lostBbl: round(rate * run, 1),
    cost: round(rate * run * cost, 2),
  };
}

/**
 * A ladder of treatments to work down, so nobody has to decide the next step
 * while the pits are going down.
 */
export function treatmentLadder({ annularCapacityBblPerFoot, systemBbl }) {
  return LOSS_BANDS.map((band) => {
    const treatment = firstTreatment({
      barrelsPerHour: band.upTo === Infinity ? 200 : band.upTo,
      annularCapacityBblPerFoot,
      systemBbl,
    });
    return {
      band: band.name,
      upToBarrelsPerHour: band.upTo === Infinity ? null : band.upTo,
      grade: band.grade,
      concentrationLbBbl: band.concentrationLbBbl,
      pillBbl: treatment.pill.volumeBbl,
      sacks: treatment.pill.sacks,
      action: treatment.action,
    };
  });
}
