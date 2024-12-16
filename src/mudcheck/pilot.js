/**
 * Pilot testing.
 *
 * Before a treatment goes in the pits it goes in a cup. A barrel equivalent in
 * the lab is 350 millilitres, so a gram in the cup is a pound in the barrel,
 * which is the only piece of arithmetic in drilling fluids that is genuinely
 * convenient.
 *
 * The part that gets got wrong is scaling a pilot that was run on a diluted
 * sample, and the part that gets skipped is checking that the pilot moved the
 * property far enough to be worth believing.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/** Millilitres that stand in for a barrel in the lab. */
export const LAB_BARREL_ML = 350;

/**
 * Grams in the cup for a treatment in pounds per barrel.
 */
export function gramsForTreatment({ poundsPerBarrel, cupMillilitres = LAB_BARREL_ML }) {
  const rate = toNonNegative(poundsPerBarrel, 'poundsPerBarrel');
  const cup = toPositive(cupMillilitres, 'cupMillilitres');
  return round((rate * cup) / LAB_BARREL_ML, 3);
}

/**
 * The treatment a pilot stands for, scaled to the system.
 */
export function scaleToSystem({ grams, cupMillilitres = LAB_BARREL_ML, systemBbl }) {
  const weight = toNonNegative(grams, 'grams');
  const cup = toPositive(cupMillilitres, 'cupMillilitres');
  const system = toPositive(systemBbl, 'systemBbl');
  const perBarrel = (weight * LAB_BARREL_ML) / cup;
  return {
    poundsPerBarrel: round(perBarrel, 3),
    totalPounds: round(perBarrel * system, 0),
  };
}

/**
 * Scale a pilot that was run on a diluted sample.
 *
 * A sample cut with water before the treatment went in is a weaker mud than
 * the one in the pits, and a rate read off it goes in light by exactly the
 * dilution.
 */
export function scaleDilutedPilot({ grams, mudMillilitres, waterMillilitres, systemBbl }) {
  const mud = toPositive(mudMillilitres, 'mudMillilitres');
  const water = toNonNegative(waterMillilitres, 'waterMillilitres');
  const straight = scaleToSystem({ grams, cupMillilitres: mud + water, systemBbl });
  const corrected = scaleToSystem({ grams, cupMillilitres: mud, systemBbl });
  return {
    asMeasuredLbBbl: straight.poundsPerBarrel,
    correctedLbBbl: corrected.poundsPerBarrel,
    totalPounds: corrected.totalPounds,
    dilution: round(water / (mud + water), 3),
    understatedBy: round(corrected.poundsPerBarrel - straight.poundsPerBarrel, 3),
  };
}

/**
 * Did the pilot move the property far enough to be believed?
 *
 * A funnel viscosity that moved two seconds is inside the repeatability of the
 * test and says nothing at all, however consistent the trend across three
 * pilots looks.
 */
export const REPEATABILITY = {
  funnelSeconds: 2,
  plasticViscosity: 2,
  yieldPoint: 2,
  filtrateApiMl: 0.5,
  ph: 0.2,
  weightPpg: 0.05,
};

export function pilotMoved({ property, before, after }) {
  const limit = REPEATABILITY[property];
  if (limit === undefined) {
    throw new Error(`there is no repeatability figure for ${property}`);
  }
  const moved = after - before;
  return {
    property,
    before,
    after,
    moved: round(moved, 3),
    repeatability: limit,
    believable: Math.abs(moved) > limit,
  };
}

/**
 * A set of pilots at different rates, with the one that first does the job.
 */
export function pilotSeries({
  property,
  target,
  before,
  pilots,
  systemBbl,
  cupMillilitres = LAB_BARREL_ML,
}) {
  const rows = pilots.map((pilot) => {
    const scaled = scaleToSystem({ grams: pilot.grams, cupMillilitres, systemBbl });
    const moved = pilotMoved({ property, before, after: pilot.after });
    return {
      grams: pilot.grams,
      ...scaled,
      ...moved,
      meetsTarget: target.max !== undefined ? pilot.after <= target.max : pilot.after >= target.min,
    };
  });
  const chosen = rows.find((row) => row.meetsTarget && row.believable) ?? null;
  return { pilots: rows, chosen };
}
