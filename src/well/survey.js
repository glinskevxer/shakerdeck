/**
 * Turning a directional survey into true vertical depth.
 *
 * Everything hydrostatic on this desk wants true vertical depth and everything
 * on a tally is measured depth. On a vertical well they are the same and
 * nobody thinks about it. On a well with sixty degrees of inclination they are
 * a long way apart, and a hydrostatic worked from measured depth comes out
 * high by exactly the amount that matters.
 *
 * The method is minimum curvature, which is what every directional company
 * uses and what the client's database will have.
 */
import { toNumber, toNonNegative, round } from '../util/number.js';

const RADIANS = Math.PI / 180;

/**
 * Read one survey station.
 */
export function readStation(record, path = 'station') {
  const measured = toNonNegative(record?.measuredDepthFeet, `${path} measuredDepthFeet`);
  const inclination = toNonNegative(record?.inclinationDegrees, `${path} inclinationDegrees`);
  const azimuth = toNumber(record?.azimuthDegrees ?? 0, `${path} azimuthDegrees`);
  if (inclination > 180) {
    throw new Error(`${path} inclinationDegrees of ${inclination} is past vertical the other way`);
  }
  return { measuredDepthFeet: measured, inclinationDegrees: inclination, azimuthDegrees: azimuth };
}

/**
 * The dogleg between two stations, in degrees.
 */
export function dogleg(from, to) {
  const inclinationOne = from.inclinationDegrees * RADIANS;
  const inclinationTwo = to.inclinationDegrees * RADIANS;
  const turn = (to.azimuthDegrees - from.azimuthDegrees) * RADIANS;
  const cosine =
    Math.cos(inclinationTwo - inclinationOne) -
    Math.sin(inclinationOne) * Math.sin(inclinationTwo) * (1 - Math.cos(turn));
  return Math.acos(Math.min(1, Math.max(-1, cosine))) / RADIANS;
}

/**
 * The ratio factor that makes the two stations a smooth arc rather than two
 * straight lines.
 */
export function ratioFactor(doglegDegrees) {
  const beta = toNonNegative(doglegDegrees, 'doglegDegrees') * RADIANS;
  if (beta < 1e-9) {
    return 1;
  }
  return (2 / beta) * Math.tan(beta / 2);
}

/**
 * Run a survey into true vertical depth and a course.
 */
export function runSurvey(stations) {
  if (!Array.isArray(stations) || stations.length === 0) {
    throw new Error('a survey needs at least one station');
  }
  const read = stations.map((record, index) => readStation(record, `station ${index + 1}`));
  for (let i = 1; i < read.length; i += 1) {
    if (read[i].measuredDepthFeet <= read[i - 1].measuredDepthFeet) {
      throw new Error(
        `station ${i + 1} is at ${read[i].measuredDepthFeet} which is not below ${read[i - 1].measuredDepthFeet}`
      );
    }
  }
  let tvd = read[0].measuredDepthFeet * Math.cos(read[0].inclinationDegrees * RADIANS);
  let north = 0;
  let east = 0;
  const rows = [
    {
      ...read[0],
      tvdFeet: round(tvd, 2),
      northFeet: 0,
      eastFeet: 0,
      doglegDegrees: 0,
      severityPer100: 0,
    },
  ];
  for (let i = 1; i < read.length; i += 1) {
    const from = read[i - 1];
    const to = read[i];
    const course = to.measuredDepthFeet - from.measuredDepthFeet;
    const beta = dogleg(from, to);
    const factor = ratioFactor(beta);
    const half = (course / 2) * factor;
    tvd +=
      half *
      (Math.cos(from.inclinationDegrees * RADIANS) + Math.cos(to.inclinationDegrees * RADIANS));
    north +=
      half *
      (Math.sin(from.inclinationDegrees * RADIANS) * Math.cos(from.azimuthDegrees * RADIANS) +
        Math.sin(to.inclinationDegrees * RADIANS) * Math.cos(to.azimuthDegrees * RADIANS));
    east +=
      half *
      (Math.sin(from.inclinationDegrees * RADIANS) * Math.sin(from.azimuthDegrees * RADIANS) +
        Math.sin(to.inclinationDegrees * RADIANS) * Math.sin(to.azimuthDegrees * RADIANS));
    rows.push({
      ...to,
      tvdFeet: round(tvd, 2),
      northFeet: round(north, 2),
      eastFeet: round(east, 2),
      doglegDegrees: round(beta, 3),
      severityPer100: round((beta * 100) / course, 3),
    });
  }
  return rows;
}

/**
 * True vertical depth at a measured depth, interpolating between stations.
 */
export function tvdAt(survey, measuredDepthFeet) {
  const depth = toNonNegative(measuredDepthFeet, 'measuredDepthFeet');
  if (depth <= survey[0].measuredDepthFeet) {
    return round((depth / survey[0].measuredDepthFeet) * survey[0].tvdFeet, 2);
  }
  const last = survey.at(-1);
  if (depth >= last.measuredDepthFeet) {
    const extra = depth - last.measuredDepthFeet;
    return round(last.tvdFeet + extra * Math.cos(last.inclinationDegrees * RADIANS), 2);
  }
  for (let i = 1; i < survey.length; i += 1) {
    if (depth <= survey[i].measuredDepthFeet) {
      const from = survey[i - 1];
      const to = survey[i];
      const share =
        (depth - from.measuredDepthFeet) / (to.measuredDepthFeet - from.measuredDepthFeet);
      return round(from.tvdFeet + share * (to.tvdFeet - from.tvdFeet), 2);
    }
  }
  return round(last.tvdFeet, 2);
}

/**
 * The worst dogleg on the survey, which is where the string will hang up.
 */
export function worstDogleg(survey) {
  return survey.reduce(
    (worst, row) => (row.severityPer100 > worst.severityPer100 ? row : worst),
    survey[0]
  );
}
