/**
 * Water on and off location.
 *
 * A rig two hours from a water station runs on what is in the tanks, and the
 * mud is the biggest user of it after the rig itself. Somebody has to know how
 * long the water lasts at the rate the mud is being built, and it is usually
 * the mud engineer because he is the one who knows the rate.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/**
 * What the mud uses over a day.
 */
export function mudWaterUse({ mudBuiltBbl, waterFraction, dilutionBbl = 0, washingBbl = 0 }) {
  const built = toNonNegative(mudBuiltBbl, 'mudBuiltBbl');
  const share = toPositive(waterFraction, 'waterFraction');
  if (share > 1) {
    throw new Error(`a water fraction of ${share} is more than all of the mud`);
  }
  const dilution = toNonNegative(dilutionBbl, 'dilutionBbl');
  const washing = toNonNegative(washingBbl, 'washingBbl');
  return {
    inNewMudBbl: round(built * share, 1),
    dilutionBbl: round(dilution, 1),
    washingBbl: round(washing, 1),
    totalBbl: round(built * share + dilution + washing, 1),
  };
}

/**
 * How long the water on location lasts.
 */
export function waterCover({ onLocationBbl, usePerDayBbl, rigUsePerDayBbl = 0 }) {
  const held = toNonNegative(onLocationBbl, 'onLocationBbl');
  const mud = toNonNegative(usePerDayBbl, 'usePerDayBbl');
  const rig = toNonNegative(rigUsePerDayBbl, 'rigUsePerDayBbl');
  const total = mud + rig;
  return {
    onLocationBbl: round(held, 1),
    usePerDayBbl: round(total, 1),
    mudShare: total === 0 ? null : round(mud / total, 3),
    daysOfCover: total === 0 ? null : round(held / total, 2),
  };
}

/**
 * Water to order, so the tanks stay above a floor.
 */
export function waterToOrder({ onLocationBbl, usePerDayBbl, coverDays, tankBbl }) {
  const wanted = toPositive(coverDays, 'coverDays') * toNonNegative(usePerDayBbl, 'usePerDayBbl');
  const held = toNonNegative(onLocationBbl, 'onLocationBbl');
  const load = toPositive(tankBbl, 'tankBbl');
  const short = Math.max(0, wanted - held);
  return {
    wantedBbl: round(wanted, 1),
    shortBbl: round(short, 1),
    loads: Math.ceil(short / load),
  };
}

/**
 * Waste water off location, which is the other half of it.
 */
export function wasteWater({ dischargeBbl, rainfallBbl = 0, evaporationBbl = 0, tankBbl }) {
  const discharge = toNonNegative(dischargeBbl, 'dischargeBbl');
  const rain = toNonNegative(rainfallBbl, 'rainfallBbl');
  const evaporated = toNonNegative(evaporationBbl, 'evaporationBbl');
  const net = Math.max(0, discharge + rain - evaporated);
  const load = toPositive(tankBbl, 'tankBbl');
  return {
    netBbl: round(net, 1),
    loads: Math.ceil(net / load),
    rainAdded: rain > 0,
  };
}

/**
 * The water balance over a period, which is what the environmental report
 * wants and what nobody keeps.
 */
export function waterBalance({ broughtInBbl, usedBbl, dischargedBbl, heldBbl }) {
  const inward = toNonNegative(broughtInBbl, 'broughtInBbl');
  const used = toNonNegative(usedBbl, 'usedBbl');
  const out = toNonNegative(dischargedBbl, 'dischargedBbl');
  const held = toNonNegative(heldBbl, 'heldBbl');
  const unaccounted = inward - used - out - held;
  return {
    broughtInBbl: round(inward, 1),
    usedBbl: round(used, 1),
    dischargedBbl: round(out, 1),
    heldBbl: round(held, 1),
    unaccountedBbl: round(unaccounted, 1),
    balances: Math.abs(unaccounted) <= Math.max(10, inward * 0.05),
  };
}
