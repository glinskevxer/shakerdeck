/**
 * Volume, length, temperature and rate conversions.
 *
 * The mud desk works in barrels and feet because the daily report does, but
 * the lab reports in millilitres and the client in some countries wants cubic
 * metres, so everything crosses here rather than being inlined at each call.
 */
import { toNumber, toPositive, round, divide } from '../util/number.js';

export const GALLONS_PER_BARREL = 42;
export const CUBIC_FEET_PER_BARREL = 5.614583;
export const LITRES_PER_BARREL = 158.987295;
export const CUBIC_METRES_PER_BARREL = 0.158987295;
export const FEET_PER_METRE = 3.280839895;
export const POUNDS_PER_KILOGRAM = 2.20462262;

export function bblToGal(bbl) {
  return toNumber(bbl, 'bbl') * GALLONS_PER_BARREL;
}

export function galToBbl(gal) {
  return divide(toNumber(gal, 'gal'), GALLONS_PER_BARREL, 'gallons per barrel');
}

export function bblToCubicFeet(bbl) {
  return toNumber(bbl, 'bbl') * CUBIC_FEET_PER_BARREL;
}

export function cubicFeetToBbl(cubicFeet) {
  return divide(toNumber(cubicFeet, 'cubicFeet'), CUBIC_FEET_PER_BARREL, 'cubic feet per barrel');
}

export function bblToCubicMetres(bbl) {
  return toNumber(bbl, 'bbl') * CUBIC_METRES_PER_BARREL;
}

export function cubicMetresToBbl(cubicMetres) {
  return divide(toNumber(cubicMetres, 'cubicMetres'), CUBIC_METRES_PER_BARREL, 'conversion');
}

export function bblToLitres(bbl) {
  return toNumber(bbl, 'bbl') * LITRES_PER_BARREL;
}

export function litresToBbl(litres) {
  return divide(toNumber(litres, 'litres'), LITRES_PER_BARREL, 'litres per barrel');
}

export function feetToMetres(feet) {
  return divide(toNumber(feet, 'feet'), FEET_PER_METRE, 'feet per metre');
}

export function metresToFeet(metres) {
  return toNumber(metres, 'metres') * FEET_PER_METRE;
}

export function inchesToMillimetres(inches) {
  return toNumber(inches, 'inches') * 25.4;
}

export function millimetresToInches(mm) {
  return divide(toNumber(mm, 'mm'), 25.4, 'conversion');
}

export function poundsToKilograms(pounds) {
  return divide(toNumber(pounds, 'pounds'), POUNDS_PER_KILOGRAM, 'conversion');
}

export function kilogramsToPounds(kilograms) {
  return toNumber(kilograms, 'kilograms') * POUNDS_PER_KILOGRAM;
}

export function fahrenheitToCelsius(f) {
  return (toNumber(f, 'fahrenheit') - 32) / 1.8;
}

export function celsiusToFahrenheit(c) {
  return toNumber(c, 'celsius') * 1.8 + 32;
}

export function fahrenheitToRankine(f) {
  const r = toNumber(f, 'fahrenheit') + 459.67;
  if (r < 0) {
    throw new Error('temperature is below absolute zero');
  }
  return r;
}

/**
 * Flow rate in gallons per minute to barrels per minute, the two units a
 * hydraulics sheet mixes freely.
 */
export function gpmToBpm(gpm) {
  return divide(toNumber(gpm, 'gpm'), GALLONS_PER_BARREL, 'gallons per barrel');
}

export function bpmToGpm(bpm) {
  return toNumber(bpm, 'bpm') * GALLONS_PER_BARREL;
}

/**
 * Volume of a vertical cylinder, in barrels. Used for round tanks and for the
 * open hole where a caliper gives one average diameter.
 */
export function cylinderVolumeBbl(diameterInches, lengthFeet) {
  const d = toPositive(diameterInches, 'diameterInches');
  const l = toNumber(lengthFeet, 'lengthFeet');
  return ((d * d) / 1029.4) * l;
}

/**
 * A volume with every unit filled in, for a report line.
 */
export function describeVolume(bbl, decimals = 1) {
  const value = toNumber(bbl, 'bbl');
  return {
    bbl: round(value, decimals),
    gal: round(bblToGal(value), 0),
    cubicFeet: round(bblToCubicFeet(value), 1),
    cubicMetres: round(bblToCubicMetres(value), 2),
  };
}
