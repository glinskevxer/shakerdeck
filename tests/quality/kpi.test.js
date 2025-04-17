import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  complianceScore,
  dilutionRatio,
  lossPerFoot,
  costAgainstBenchmark,
  scorecard,
} from '../../src/quality/kpi.js';
import { readChecks } from '../../src/mudcheck/record.js';
import { readProgramme } from '../../src/program/window.js';

const checks = readChecks(JSON.parse(readFileSync('examples/checks-brazos.json', 'utf8')));
const programme = readProgramme(JSON.parse(readFileSync('examples/programme-brazos.json', 'utf8')));

describe('complianceScore', () => {
  it('scores the share of checks inside the window', () => {
    const score = complianceScore({ checks, programme });
    expect(score.judged).toBe(6);
    expect(score.score).toBeGreaterThan(0.8);
  });

  it('has no score when nothing could be judged', () => {
    const deep = readProgramme({
      well: 'x',
      sections: [{ name: 'surface', fromFeet: 0, toFeet: 100, limits: {} }],
    });
    expect(complianceScore({ checks, programme: deep }).score).toBe(null);
  });
});

describe('dilutionRatio', () => {
  it('is good on a tight well', () => {
    expect(dilutionRatio({ dilutionBbl: 400, holeVolumeBbl: 400 })).toEqual({
      ratio: 1,
      band: 'good',
    });
  });

  it('is fair in the middle', () => {
    expect(dilutionRatio({ dilutionBbl: 1200, holeVolumeBbl: 400 }).band).toBe('fair');
  });

  it('is poor on a well whose solids control was off', () => {
    expect(dilutionRatio({ dilutionBbl: 2000, holeVolumeBbl: 400 }).band).toBe('poor');
  });

  it('is nothing at all with no dilution', () => {
    expect(dilutionRatio({ dilutionBbl: 0, holeVolumeBbl: 400 }).ratio).toBe(0);
  });
});

describe('lossPerFoot', () => {
  it('divides the mud lost by the footage', () => {
    expect(lossPerFoot({ mudLostBbl: 300, footageFeet: 4450 })).toBeCloseTo(0.0674, 4);
  });

  it('refuses a well that drilled nothing', () => {
    expect(() => lossPerFoot({ mudLostBbl: 300, footageFeet: 0 })).toThrow(/above zero/);
  });
});

describe('costAgainstBenchmark', () => {
  it('is under when it came in cheaper', () => {
    const cost = costAgainstBenchmark({ costPerFoot: 9.05, benchmarkPerFoot: 12 });
    expect(cost.under).toBe(true);
    expect(cost.ratio).toBeLessThan(1);
  });

  it('is over when it did not', () => {
    expect(costAgainstBenchmark({ costPerFoot: 15, benchmarkPerFoot: 12 }).under).toBe(false);
  });
});

describe('scorecard', () => {
  const card = scorecard({
    checks,
    programme,
    dilutionBbl: 600,
    holeVolumeBbl: 400,
    mudLostBbl: 300,
    footageFeet: 4450,
    costPerFoot: 9.05,
    benchmarkPerFoot: 12,
  });

  it('carries a row for every number the client scores on', () => {
    expect(card.rows.map((row) => row.name)).toEqual([
      'in window',
      'dilution ratio',
      'mud lost per foot',
      'cost against benchmark',
    ]);
  });

  it('says which way each one is better', () => {
    expect(card.rows.find((row) => row.name === 'in window').better).toBe('higher');
    expect(card.rows.find((row) => row.name === 'dilution ratio').better).toBe('lower');
  });

  it('adds the spread utilisation when it is known', () => {
    const withSpread = scorecard({
      checks,
      programme,
      dilutionBbl: 600,
      holeVolumeBbl: 400,
      mudLostBbl: 300,
      footageFeet: 4450,
      costPerFoot: 9.05,
      benchmarkPerFoot: 12,
      spreadUtilisation: 0.62,
    });
    expect(withSpread.rows).toHaveLength(5);
  });

  it('flags a well that was outside its window more than one check in ten', () => {
    expect(card.flags).toEqual(['in window']);
  });

  it('flags nothing at all on a well that stayed inside it', () => {
    const clean = scorecard({
      checks,
      programme: readProgramme({
        well: 'brazos 14-3',
        sections: [
          { name: 'all', fromFeet: 0, toFeet: 12000, limits: { weightPpg: { min: 8, max: 18 } } },
        ],
      }),
      dilutionBbl: 600,
      holeVolumeBbl: 400,
      mudLostBbl: 300,
      footageFeet: 4450,
      costPerFoot: 9.05,
      benchmarkPerFoot: 12,
    });
    expect(clean.flags).toEqual([]);
  });

  it('flags the dilution and the cost on a well that did not', () => {
    const poor = scorecard({
      checks,
      programme,
      dilutionBbl: 2400,
      holeVolumeBbl: 400,
      mudLostBbl: 900,
      footageFeet: 4450,
      costPerFoot: 18,
      benchmarkPerFoot: 12,
    });
    expect(poor.flags).toContain('dilution ratio');
    expect(poor.flags).toContain('cost against benchmark');
  });
});
