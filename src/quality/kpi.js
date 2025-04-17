/**
 * The numbers the client scores the job on.
 *
 * Every service company has a version of this and most of them are chosen so
 * the company scores well. These are the ones that are hard to move without
 * doing the job properly: how much of the time the mud was inside its own
 * window, how much dilution it took to hold the solids, how much mud left with
 * the cuttings and how much of the spread was actually running.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { exceptionReport } from './exceptions.js';

/**
 * The share of checks that were inside the window.
 */
export function complianceScore({ checks, programme }) {
  const report = exceptionReport(checks, programme);
  if (report.judged === 0) {
    return { judged: 0, inWindow: 0, score: null };
  }
  return {
    judged: report.judged,
    inWindow: report.judged - report.outside,
    score: round(1 - report.outsideShare, 3),
  };
}

/**
 * Dilution as a multiple of the hole that was drilled.
 *
 * A well that took four barrels of dilution for every barrel of hole is a well
 * whose solids control was not running.
 */
export function dilutionRatio({ dilutionBbl, holeVolumeBbl }) {
  const dilution = toNonNegative(dilutionBbl, 'dilutionBbl');
  const hole = toPositive(holeVolumeBbl, 'holeVolumeBbl');
  const ratio = dilution / hole;
  let band = 'good';
  if (ratio > 4) {
    band = 'poor';
  } else if (ratio > 2) {
    band = 'fair';
  }
  return { ratio: round(ratio, 2), band };
}

/**
 * Mud lost per foot drilled, which is the one the client's cost engineer reads.
 */
export function lossPerFoot({ mudLostBbl, footageFeet }) {
  const lost = toNonNegative(mudLostBbl, 'mudLostBbl');
  const footage = toPositive(footageFeet, 'footageFeet');
  return round(lost / footage, 4);
}

/**
 * Cost per foot against a benchmark, which is the only way it means anything.
 */
export function costAgainstBenchmark({ costPerFoot, benchmarkPerFoot }) {
  const actual = toNonNegative(costPerFoot, 'costPerFoot');
  const benchmark = toPositive(benchmarkPerFoot, 'benchmarkPerFoot');
  return {
    costPerFoot: round(actual, 2),
    benchmarkPerFoot: round(benchmark, 2),
    ratio: round(actual / benchmark, 3),
    under: actual <= benchmark,
  };
}

/**
 * The whole card.
 */
export function scorecard({
  checks,
  programme,
  dilutionBbl,
  holeVolumeBbl,
  mudLostBbl,
  footageFeet,
  costPerFoot,
  benchmarkPerFoot,
  spreadUtilisation = null,
}) {
  const compliance = complianceScore({ checks, programme });
  const dilution = dilutionRatio({ dilutionBbl, holeVolumeBbl });
  const cost = costAgainstBenchmark({ costPerFoot, benchmarkPerFoot });
  const rows = [
    { name: 'in window', value: compliance.score, better: 'higher' },
    { name: 'dilution ratio', value: dilution.ratio, better: 'lower' },
    { name: 'mud lost per foot', value: lossPerFoot({ mudLostBbl, footageFeet }), better: 'lower' },
    { name: 'cost against benchmark', value: cost.ratio, better: 'lower' },
  ];
  if (spreadUtilisation !== null) {
    rows.push({
      name: 'solids control running',
      value: round(toNonNegative(spreadUtilisation, 'spreadUtilisation'), 3),
      better: 'higher',
    });
  }
  return {
    rows,
    compliance,
    dilution,
    cost,
    flags: rows
      .filter((row) =>
        row.name === 'dilution ratio'
          ? dilution.band === 'poor'
          : row.name === 'cost against benchmark'
            ? !cost.under
            : row.name === 'in window'
              ? row.value !== null && row.value < 0.9
              : false
      )
      .map((row) => row.name),
  };
}
