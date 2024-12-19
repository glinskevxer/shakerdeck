/**
 * Discharge, and whether it is allowed.
 *
 * Offshore and in a lot of onshore jurisdictions there is a limit on how much
 * base fluid can leave with the cuttings, quoted as a percentage of the dry
 * weight of the rock. It is measured by retort on a cuttings sample and it is
 * the number an inspector asks for.
 *
 * The limit is a rolling average over the section rather than a single sample,
 * which means one bad sample does not stop the job and a run of mediocre ones
 * quietly does.
 */
import { toPositive, toNonNegative, round, mean } from '../util/number.js';
import { LOW_GRAVITY_SG, POUNDS_PER_BARREL_WATER } from '../solids/analysis.js';

/** Retention on cuttings limits, as a share of the dry cuttings weight. */
export const DISCHARGE_LIMITS = {
  'north sea': 0.01,
  'gulf of mexico': 0.0915,
  'onshore pit': null,
};

/**
 * Retention on cuttings as a share of the dry rock weight.
 */
export function retentionShare({ sampleGrams, oilGrams, solidsGrams }) {
  const sample = toPositive(sampleGrams, 'sampleGrams');
  const oil = toNonNegative(oilGrams, 'oilGrams');
  const solids = toPositive(solidsGrams, 'solidsGrams');
  if (oil + solids > sample + 1e-9) {
    throw new Error('the oil and the solids weigh more than the sample they came out of');
  }
  return {
    share: round(oil / solids, 4),
    percentOfDryWeight: round((oil / solids) * 100, 2),
    waterGrams: round(sample - oil - solids, 3),
  };
}

/**
 * Judge a run of samples against a limit.
 */
export function dischargeCompliance({ samples, area = 'north sea' }) {
  if (!Object.prototype.hasOwnProperty.call(DISCHARGE_LIMITS, area)) {
    throw new Error(`there is no discharge limit on file for ${area}`);
  }
  const limit = DISCHARGE_LIMITS[area];
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('there are no samples to judge');
  }
  const rows = samples.map((sample, index) => {
    const retention = retentionShare(sample);
    return {
      label: sample.label ?? `sample ${index + 1}`,
      ...retention,
      overLimit: limit === null ? false : retention.share > limit,
    };
  });
  const average = mean(
    rows.map((row) => row.share),
    'shares'
  );
  return {
    area,
    limit,
    samples: rows,
    averageShare: round(average, 4),
    averagePercent: round(average * 100, 2),
    compliant: limit === null ? true : average <= limit,
    samplesOverLimit: rows.filter((row) => row.overLimit).length,
  };
}

/**
 * The base fluid a section will send over the side at a retention.
 */
export function baseFluidDischarged({ rockBbl, retentionShare: share }) {
  const rock = toNonNegative(rockBbl, 'rockBbl');
  const retention = toNonNegative(share, 'retentionShare');
  const dryPounds = rock * POUNDS_PER_BARREL_WATER * LOW_GRAVITY_SG;
  return {
    dryCuttingsPounds: round(dryPounds, 0),
    baseFluidPounds: round(dryPounds * retention, 0),
    baseFluidBbl: round((dryPounds * retention) / (POUNDS_PER_BARREL_WATER * 0.84), 2),
  };
}

/**
 * How much drier the cuttings have to get to bring a section inside a limit.
 */
export function dryingNeeded({ currentShare, area = 'north sea' }) {
  const limit = DISCHARGE_LIMITS[area];
  if (limit === undefined) {
    throw new Error(`there is no discharge limit on file for ${area}`);
  }
  if (limit === null) {
    return { needed: false, reduceBy: 0, reason: 'no limit applies here' };
  }
  const current = toNonNegative(currentShare, 'currentShare');
  if (current <= limit) {
    return { needed: false, reduceBy: 0, reason: 'already inside the limit' };
  }
  return {
    needed: true,
    reduceBy: round(current - limit, 4),
    shareOfCurrent: round((current - limit) / current, 3),
    reason: `the cuttings carry ${round(current * 100, 2)} percent against a limit of ${round(limit * 100, 2)}`,
  };
}
