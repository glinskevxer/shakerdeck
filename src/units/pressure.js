/**
 * Pressure, in the four units a rig quotes it in.
 *
 * The gauge is in psi, the client's engineering group works in bar or in
 * kilopascals, and the mud programme quotes everything as an equivalent mud
 * weight because that is the only unit that carries the depth with it.
 */
import { toPositive, toNumber, round } from '../util/number.js';
import { GRADIENT_PER_PPG } from './density.js';

export const BAR_PER_PSI = 0.0689476;
export const KPA_PER_PSI = 6.89476;
export const PSI_PER_ATMOSPHERE = 14.6959;

export function psiToBar(psi) {
  return toNumber(psi, 'psi') * BAR_PER_PSI;
}

export function barToPsi(bar) {
  return toNumber(bar, 'bar') / BAR_PER_PSI;
}

export function psiToKilopascal(psi) {
  return toNumber(psi, 'psi') * KPA_PER_PSI;
}

export function kilopascalToPsi(kilopascal) {
  return toNumber(kilopascal, 'kilopascal') / KPA_PER_PSI;
}

export function psiToAtmospheres(psi) {
  return toNumber(psi, 'psi') / PSI_PER_ATMOSPHERE;
}

/**
 * A pressure as the mud weight that would produce it at a depth.
 *
 * This is the only conversion here that needs a second number, and leaving the
 * depth out of a conversation about equivalent weight is how two people end up
 * quoting different numbers for the same pressure.
 */
export function psiToEquivalentWeight({ psi, tvdFeet }) {
  return toNumber(psi, 'psi') / (GRADIENT_PER_PPG * toPositive(tvdFeet, 'tvdFeet'));
}

export function equivalentWeightToPsi({ ppg, tvdFeet }) {
  return GRADIENT_PER_PPG * toNumber(ppg, 'ppg') * toPositive(tvdFeet, 'tvdFeet');
}

/**
 * A pressure with every unit filled in, for a report line.
 */
export function describePressure(psi, { tvdFeet = null, decimals = 1 } = {}) {
  const value = toNumber(psi, 'psi');
  return {
    psi: round(value, decimals),
    bar: round(psiToBar(value), 2),
    kilopascal: round(psiToKilopascal(value), 0),
    atmospheres: round(psiToAtmospheres(value), 2),
    equivalentPpg:
      tvdFeet === null ? null : round(psiToEquivalentWeight({ psi: value, tvdFeet }), 3),
  };
}

/**
 * A gradient in the two forms a programme uses.
 */
export function describeGradient(psiPerFoot) {
  const gradient = toPositive(psiPerFoot, 'psiPerFoot');
  return {
    psiPerFoot: round(gradient, 4),
    ppg: round(gradient / GRADIENT_PER_PPG, 2),
    barPerMetre: round(psiToBar(gradient) * 3.280839895, 4),
  };
}
