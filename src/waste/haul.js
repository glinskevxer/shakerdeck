/**
 * Getting the discharge off location.
 *
 * A skip that is full and a truck that is two hours away is a rig that stops
 * drilling. The whole of it is a rate comparison between how fast the hole is
 * making cuttings and how fast the trucks can take them, and the number that
 * matters is how long the pad has before it runs out of empty skips.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/**
 * How fast the discharge is arriving, in barrels an hour.
 */
export function dischargeRate({ penetrationFeetPerHour, bitDiameterInches, retentionShare = 0.4 }) {
  const rate = toNonNegative(penetrationFeetPerHour, 'penetrationFeetPerHour');
  const bit = toPositive(bitDiameterInches, 'bitDiameterInches');
  const share = toNonNegative(retentionShare, 'retentionShare');
  if (share >= 1) {
    throw new Error('a discharge that is all liquid is not cuttings');
  }
  const rock = ((bit * bit) / 1029.4) * rate;
  return round(rock / (1 - share), 3);
}

/**
 * How long the skips on location will last.
 */
export function skipCover({ skips, skipBbl, dischargeBblPerHour, alreadyFullBbl = 0 }) {
  const count = toPositive(skips, 'skips');
  const size = toPositive(skipBbl, 'skipBbl');
  const rate = toNonNegative(dischargeBblPerHour, 'dischargeBblPerHour');
  const used = toNonNegative(alreadyFullBbl, 'alreadyFullBbl');
  const capacity = count * size - used;
  if (capacity <= 0) {
    return { capacityBbl: 0, hoursOfCover: 0, full: true };
  }
  return {
    capacityBbl: round(capacity, 2),
    hoursOfCover: rate === 0 ? null : round(capacity / rate, 1),
    full: false,
  };
}

/**
 * How many trucks a day the hole needs.
 */
export function trucksPerDay({ dischargeBblPerHour, skipBbl, hoursPerDay = 24 }) {
  const rate = toNonNegative(dischargeBblPerHour, 'dischargeBblPerHour');
  const size = toPositive(skipBbl, 'skipBbl');
  const hours = toPositive(hoursPerDay, 'hoursPerDay');
  return {
    barrelsPerDay: round(rate * hours, 2),
    loadsPerDay: round((rate * hours) / size, 2),
    trucksPerDay: Math.ceil((rate * hours) / size),
  };
}

/**
 * Whether the haulage keeps up with the hole.
 */
export function haulageKeepsUp({
  dischargeBblPerHour,
  skipBbl,
  trucksAvailablePerDay,
  turnaroundHours,
}) {
  const needed = trucksPerDay({ dischargeBblPerHour, skipBbl });
  const available = toPositive(trucksAvailablePerDay, 'trucksAvailablePerDay');
  const turnaround = toPositive(turnaroundHours, 'turnaroundHours');
  const runsPerTruck = Math.floor(24 / turnaround);
  const capacity = available * runsPerTruck;
  return {
    loadsNeededPerDay: needed.trucksPerDay,
    loadsAvailablePerDay: capacity,
    keepsUp: capacity >= needed.trucksPerDay,
    shortLoadsPerDay: capacity >= needed.trucksPerDay ? 0 : needed.trucksPerDay - capacity,
    runsPerTruck,
  };
}

/**
 * When the pad fills up, given what is on it now and what is coming.
 */
export function fillsUpIn({ skips, skipBbl, alreadyFullBbl, dischargeBblPerHour, loadsPerDay }) {
  const cover = skipCover({ skips, skipBbl, dischargeBblPerHour, alreadyFullBbl });
  if (cover.full) {
    return { hours: 0, everFills: true };
  }
  const removed = (toNonNegative(loadsPerDay, 'loadsPerDay') * toPositive(skipBbl, 'skipBbl')) / 24;
  const net = toNonNegative(dischargeBblPerHour, 'dischargeBblPerHour') - removed;
  if (net <= 0) {
    return { hours: null, everFills: false };
  }
  return { hours: round(cover.capacityBbl / net, 1), everFills: true };
}
