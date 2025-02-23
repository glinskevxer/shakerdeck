import { describe, it, expect } from 'vitest';
import {
  duplicate,
  copiedLines,
  tooPrecise,
  PRECISION,
  labReview,
  scatter,
} from '../../src/quality/lab.js';
import { readChecks } from '../../src/mudcheck/record.js';

const varied = readChecks(
  [12.4, 12.5, 12.4, 12.6, 12.5, 12.4, 12.6, 12.5].map((weight, index) => ({
    well: 'brazos 14-3',
    date: `2025-03-${String(index + 1).padStart(2, '0')}`,
    depthFeet: 9000 + index * 100,
    weightPpg: weight,
    ph: 9.5 + (index % 2) * 0.1,
  }))
);

const copied = readChecks(
  Array.from({ length: 8 }, (_, index) => ({
    well: 'brazos 14-3',
    date: `2025-03-${String(index + 1).padStart(2, '0')}`,
    depthFeet: 9000 + index * 100,
    weightPpg: 12.4,
    ph: 9.5,
  }))
);

describe('duplicate', () => {
  it('agrees when two hands land inside the repeatability', () => {
    expect(duplicate({ property: 'funnelSeconds', first: 46, second: 47 }).agrees).toBe(true);
  });

  it('disagrees when they do not', () => {
    const check = duplicate({ property: 'filtrateApiMl', first: 4.8, second: 6.4 });
    expect(check.agrees).toBe(false);
    expect(check.difference).toBeCloseTo(1.6, 3);
  });

  it('carries the repeatability it judged against', () => {
    expect(duplicate({ property: 'ph', first: 9.4, second: 9.5 }).repeatability).toBe(0.2);
  });

  it('refuses a property with no repeatability figure', () => {
    expect(() => duplicate({ property: 'gels', first: 6, second: 9 })).toThrow(
      /no repeatability figure/
    );
  });
});

describe('copiedLines', () => {
  it('finds nothing on a mud that moves', () => {
    expect(copiedLines(varied, 'weightPpg')).toEqual([]);
  });

  it('finds a run that never moved', () => {
    const runs = copiedLines(copied, 'weightPpg');
    expect(runs).toHaveLength(1);
    expect(runs[0].length).toBe(8);
    expect(runs[0].value).toBe(12.4);
  });

  it('carries the dates the run covers', () => {
    const runs = copiedLines(copied, 'weightPpg');
    expect(runs[0].from).toBe('2025-03-01');
    expect(runs[0].to).toBe('2025-03-08');
  });

  it('takes a shorter run when asked', () => {
    expect(copiedLines(varied, 'ph', { runLength: 2 })).toEqual([]);
    expect(copiedLines(copied, 'ph', { runLength: 3 })).toHaveLength(1);
  });

  it('finds nothing where the property was never measured', () => {
    expect(copiedLines(varied, 'chlorideMgL')).toEqual([]);
  });
});

describe('tooPrecise', () => {
  it('accepts a weight to two places', () => {
    expect(tooPrecise({ property: 'weightPpg', value: 12.45 }).tooPrecise).toBe(false);
  });

  it('rejects one to four', () => {
    expect(tooPrecise({ property: 'weightPpg', value: 12.4512 }).tooPrecise).toBe(true);
  });

  it('rejects a funnel viscosity with a decimal on it', () => {
    expect(tooPrecise({ property: 'funnelSeconds', value: 46.5 }).tooPrecise).toBe(true);
    expect(PRECISION.funnelSeconds).toBe(0);
  });

  it('says nothing about a property it has no rule for', () => {
    const judged = tooPrecise({ property: 'yieldPoint', value: 20.12345 });
    expect(judged.tooPrecise).toBe(false);
    expect(judged.allowedPlaces).toBe(null);
  });
});

describe('labReview', () => {
  it('is clean on a run that moves and is written to the right precision', () => {
    expect(labReview(varied).clean).toBe(true);
  });

  it('finds the copied lines', () => {
    const review = labReview(copied);
    expect(review.clean).toBe(false);
    expect(review.copiedRuns.map((run) => run.property)).toContain('weightPpg');
  });

  it('finds a reading written to more places than the test gives', () => {
    const precise = readChecks(
      varied.map((check, index) =>
        index === 0 ? { ...check, funnelSeconds: 46.5 } : { ...check, funnelSeconds: 46 }
      )
    );
    const review = labReview(precise);
    expect(review.overPrecise[0].property).toBe('funnelSeconds');
    expect(review.overPrecise[0].date).toBe('2025-03-01');
  });
});

describe('scatter', () => {
  it('reports the spread of a property that moves', () => {
    const spread = scatter(varied, 'weightPpg');
    expect(spread.readings).toBe(8);
    expect(spread.standardDeviation).toBeGreaterThan(0);
    expect(spread.suspiciouslyFlat).toBe(false);
  });

  it('flags a property with no scatter at all', () => {
    expect(scatter(copied, 'weightPpg').suspiciouslyFlat).toBe(true);
  });

  it('has no answer with fewer than three readings', () => {
    expect(scatter(varied.slice(0, 2), 'weightPpg')).toBe(null);
  });
});
