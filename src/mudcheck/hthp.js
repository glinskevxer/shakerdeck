/**
 * High temperature high pressure filtration.
 *
 * The cell has half the filter area of the API press, so the volume that comes
 * out of it is doubled before it goes on the report. Forgetting that halves
 * the number and makes a mud that is losing filtrate into the formation look
 * like a mud that is holding.
 *
 * The other half of the test is the spurt: the volume that comes through
 * before the cake forms. A mud with a low thirty minute figure and a large
 * spurt is a mud with no bridging in it, and the thirty minute figure on its
 * own does not show that.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/** The cell is half the area of the api press, so its volume doubles. */
export const HTHP_AREA_FACTOR = 2;

/**
 * The reported filtrate from the volume in the cylinder.
 */
export function reportedFiltrate(collectedMillilitres) {
  return round(toNonNegative(collectedMillilitres, 'collectedMillilitres') * HTHP_AREA_FACTOR, 2);
}

/**
 * Spurt loss, from the volume at the first reading extrapolated back to time
 * zero on the square root of time.
 */
export function spurtLoss({ atMinutes, collectedMillilitres, thirtyMinuteMillilitres }) {
  const time = toPositive(atMinutes, 'atMinutes');
  if (time >= 30) {
    throw new Error(`a spurt reading has to be before thirty minutes, not at ${time}`);
  }
  const early = reportedFiltrate(collectedMillilitres);
  const late = toPositive(thirtyMinuteMillilitres, 'thirtyMinuteMillilitres');
  const slope = (late - early) / (Math.sqrt(30) - Math.sqrt(time));
  const spurt = early - slope * Math.sqrt(time);
  return {
    spurtMillilitres: round(Math.max(0, spurt), 2),
    slopePerRootMinute: round(slope, 3),
    hasBridging: spurt <= late * 0.25,
  };
}

/**
 * The filtrate the fit predicts at any time.
 */
export function filtrateAt({ spurtMillilitres, slopePerRootMinute, minutes }) {
  const time = toNonNegative(minutes, 'minutes');
  return round(
    toNonNegative(spurtMillilitres, 'spurtMillilitres') + slopePerRootMinute * Math.sqrt(time),
    2
  );
}

/**
 * What the API and HTHP figures say together.
 *
 * A mud whose HTHP is more than about four times its API filtrate is a mud
 * whose fluid loss control is falling apart at temperature, however good the
 * API figure looks on the report.
 */
export function filtrationVerdict({ apiMl, hthpMl, hthpTemperatureF }) {
  const api = toPositive(apiMl, 'apiMl');
  const hot = toPositive(hthpMl, 'hthpMl');
  const temperature = toPositive(hthpTemperatureF, 'hthpTemperatureF');
  const ratio = hot / api;
  let level = 'holding';
  if (ratio >= 6) {
    level = 'failing at temperature';
  } else if (ratio >= 4) {
    level = 'thinning at temperature';
  }
  return {
    apiMl: round(api, 2),
    hthpMl: round(hot, 2),
    temperatureF: temperature,
    ratio: round(ratio, 2),
    level,
  };
}

/**
 * The whole test, as the report prints it.
 */
export function hthpSummary({
  collectedMillilitres,
  apiMl,
  temperatureF,
  spurtAtMinutes = null,
  spurtCollectedMillilitres = null,
  cakeThirtySecondInch = null,
}) {
  const reported = reportedFiltrate(collectedMillilitres);
  const spurt =
    spurtAtMinutes === null || spurtCollectedMillilitres === null
      ? null
      : spurtLoss({
          atMinutes: spurtAtMinutes,
          collectedMillilitres: spurtCollectedMillilitres,
          thirtyMinuteMillilitres: reported,
        });
  return {
    hthpMl: reported,
    cakeThirtySecondInch,
    spurt,
    ...filtrationVerdict({ apiMl, hthpMl: reported, hthpTemperatureF: temperatureF }),
  };
}
