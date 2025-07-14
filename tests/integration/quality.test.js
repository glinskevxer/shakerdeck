import { describe, it, expect } from 'vitest';
import { fixtures } from '../support/fixtures.js';
import { readChecks } from '../../src/mudcheck/record.js';
import { readProgramme } from '../../src/program/window.js';
import { exceptionReport } from '../../src/quality/exceptions.js';
import { chart } from '../../src/quality/control.js';
import { labReview, copiedLines } from '../../src/quality/lab.js';
import { series } from '../../src/quality/series.js';
import { diagnose } from '../../src/cli/commands/doctor.js';

const programme = readProgramme(fixtures.programme);

/**
 * A run where every reading is inside the window and the weight walks steadily
 * up. The first question passes it and the second one does not, which is the
 * whole reason both exist.
 */
const drifting = readChecks(
  Array.from({ length: 12 }, (_, index) => ({
    well: 'brazos 14-3',
    date: `2025-07-${String(index + 1).padStart(2, '0')}`,
    depthFeet: 9000 + index * 120,
    weightPpg: 12.02 + index * 0.06,
    funnelSeconds: 44 + (index % 3),
  }))
);

const copied = readChecks(
  Array.from({ length: 10 }, (_, index) => ({
    well: 'brazos 14-3',
    date: `2025-07-${String(index + 1).padStart(2, '0')}`,
    depthFeet: 9000 + index * 120,
    weightPpg: 12.4,
    funnelSeconds: 46,
  }))
);

describe('the three questions are not the same question', () => {
  it('the window says a drifting mud is fine', () => {
    const report = exceptionReport(drifting, programme);
    expect(report.judged).toBe(12);
    expect(report.outside).toBe(0);
  });

  it('the chart says it is not', () => {
    const weights = series(drifting, 'weightPpg').points.map((point) => point.value);
    const result = chart('weightPpg', weights);
    expect(result.inControl).toBe(false);
    expect(result.signals.some((signal) => signal.rule.includes('climbing'))).toBe(true);
  });

  it('the lab review says the drifting sheet is a real sheet', () => {
    expect(labReview(drifting).copiedRuns).toEqual([]);
  });

  it('and says the flat one is not', () => {
    const review = labReview(copied);
    expect(review.clean).toBe(false);
    expect(review.copiedRuns.map((run) => run.property)).toContain('weightPpg');
  });

  it('the window and the chart both pass the flat sheet', () => {
    const report = exceptionReport(copied, programme);
    expect(report.outside).toBe(0);
    const weights = series(copied, 'weightPpg').points.map((point) => point.value);
    expect(chart('weightPpg', weights).inControl).toBe(true);
  });
});

describe('doctor catches what the three of them miss between them', () => {
  it('finds a check below the bottom of the hole', () => {
    const result = diagnose({
      well: fixtures.well,
      checks: [...fixtures.checks, { ...fixtures.checks[0], depthFeet: 20000 }],
    });
    expect(result.errors).toBeGreaterThan(0);
  });

  it('finds a movement for a product that does not exist', () => {
    const result = diagnose({
      products: fixtures.products,
      movements: [{ date: '2025-07-01', code: 'NOPE', kind: 'used', quantity: 1 }],
    });
    expect(result.notes.some((note) => note.message.includes('NOPE'))).toBe(true);
  });

  it('finds the copied lines as well', () => {
    const result = diagnose({ checks: copied.map((check) => ({ ...check, dials: undefined })) });
    expect(result.notes.some((note) => note.message.includes('in a row'))).toBe(true);
  });

  it('is clean on the example set', () => {
    expect(
      diagnose({
        well: fixtures.well,
        checks: fixtures.checks,
        programme: fixtures.programme,
        products: fixtures.products,
        movements: fixtures.movements,
        days: fixtures.days,
      }).errors
    ).toBe(0);
  });
});

describe('a run of copied lines is found the same way from either end', () => {
  it('by the lab review and by doctor', () => {
    const bare = copied.map((check) => ({ ...check, dials: undefined }));
    const fromLab = copiedLines(copied, 'weightPpg').length;
    const fromDoctor = diagnose({ checks: bare }).notes.filter((note) =>
      note.message.includes('weightPpg')
    ).length;
    expect(fromLab).toBe(fromDoctor);
  });
});
