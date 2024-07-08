/**
 * Invert emulsions: the readings that only exist on an oil based mud.
 *
 * The oil to water ratio is the one that gets quoted, and it is a ratio of the
 * liquid phase only. Reading it off the whole retort instead, solids included,
 * puts it several points out on a weighted mud and the correction is always in
 * the same direction, so nobody notices until a bill for base oil arrives.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/**
 * Oil to water ratio from a retort, as two numbers that add to a hundred.
 */
export function oilWaterRatio({ oilPercent, waterPercent }) {
  const oil = toNonNegative(oilPercent, 'oilPercent');
  const water = toNonNegative(waterPercent, 'waterPercent');
  const liquid = oil + water;
  if (liquid === 0) {
    throw new Error('the retort found no liquid at all');
  }
  return {
    oil: round((oil * 100) / liquid, 1),
    water: round((water * 100) / liquid, 1),
  };
}

/**
 * Volume to add to move the ratio, in barrels per hundred barrels of mud.
 *
 * A ratio is moved with oil when it needs to go up and with brine when it
 * needs to come down. Either way the mud gets bigger, which is the cost of
 * doing it this way rather than by centrifuging.
 */
export function ratioAdjustment({ oilPercent, waterPercent, targetOil, volumeBbl }) {
  const oil = toNonNegative(oilPercent, 'oilPercent');
  const water = toNonNegative(waterPercent, 'waterPercent');
  const target = toPositive(targetOil, 'targetOil');
  const volume = toPositive(volumeBbl, 'volumeBbl');
  if (target >= 100) {
    throw new Error('an invert emulsion needs some water in it');
  }
  const current = oilWaterRatio({ oilPercent: oil, waterPercent: water });
  const oilBbl = (volume * oil) / 100;
  const waterBbl = (volume * water) / 100;
  if (Math.abs(current.oil - target) < 1e-9) {
    return { addOilBbl: 0, addBrineBbl: 0, finalVolumeBbl: round(volume, 1) };
  }
  if (target > current.oil) {
    const add = (target * waterBbl) / (100 - target) - oilBbl;
    return {
      addOilBbl: round(add, 1),
      addBrineBbl: 0,
      finalVolumeBbl: round(volume + add, 1),
    };
  }
  const add = ((100 - target) * oilBbl) / target - waterBbl;
  return {
    addOilBbl: 0,
    addBrineBbl: round(add, 1),
    finalVolumeBbl: round(volume + add, 1),
  };
}

/**
 * What an electrical stability reading says about the emulsion.
 *
 * The number on its own means less than the direction it is moving. A mud
 * sitting at four hundred volts all week is fine and one that has fallen from
 * six hundred to four hundred over two days is breaking.
 */
export function stabilityVerdict(volts) {
  const reading = toNonNegative(volts, 'volts');
  if (reading >= 500) {
    return 'strong';
  }
  if (reading >= 300) {
    return 'serviceable';
  }
  if (reading >= 150) {
    return 'weak';
  }
  return 'breaking';
}

/**
 * The trend over a run of readings, which is what actually matters.
 */
export function stabilityTrend(readings) {
  if (!Array.isArray(readings) || readings.length < 2) {
    throw new Error('a trend needs at least two readings');
  }
  const values = readings.map((reading, index) => toNonNegative(reading, `reading ${index + 1}`));
  const first = values[0];
  const last = values.at(-1);
  const change = last - first;
  const share = change / first;
  let direction = 'holding';
  if (share <= -0.2) {
    direction = 'falling';
  } else if (share >= 0.2) {
    direction = 'climbing';
  }
  return {
    first,
    last,
    changeVolts: round(change, 0),
    direction,
    verdict: stabilityVerdict(last),
    treat: direction === 'falling' || stabilityVerdict(last) === 'breaking',
  };
}

/**
 * Brine needed to hold a water phase salinity while water comes in from the
 * formation, in pounds of calcium chloride per barrel of water phase.
 */
export function calciumChlorideForSalinity({ targetMgL, currentMgL, waterBbl }) {
  const target = toPositive(targetMgL, 'targetMgL');
  const current = toNonNegative(currentMgL, 'currentMgL');
  const water = toPositive(waterBbl, 'waterBbl');
  if (target <= current) {
    return { poundsNeeded: 0, alreadyAbove: true };
  }
  // Calcium chloride carries 0.639 parts chloride by weight.
  const chlorideNeeded = (target - current) * 0.00035 * water;
  return {
    poundsNeeded: round(chlorideNeeded / 0.639, 1),
    alreadyAbove: false,
  };
}

/**
 * The invert block of the report.
 */
export function invertSummary({ retort, electricalStabilityVolts, chlorideMgL }) {
  if (!retort || retort.oilPercent === 0) {
    return null;
  }
  const ratio = oilWaterRatio(retort);
  return {
    oilWaterRatio: `${ratio.oil} / ${ratio.water}`,
    oilShare: ratio.oil,
    waterShare: ratio.water,
    electricalStabilityVolts: electricalStabilityVolts ?? null,
    stability:
      electricalStabilityVolts === null || electricalStabilityVolts === undefined
        ? null
        : stabilityVerdict(electricalStabilityVolts),
    waterPhaseSalinityMgL:
      chlorideMgL === null || chlorideMgL === undefined
        ? null
        : round((chlorideMgL * 100) / retort.waterPercent, 0),
  };
}
