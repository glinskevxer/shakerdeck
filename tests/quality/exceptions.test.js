import { describe, it, expect } from 'vitest';
import {
  judgeable,
  exceptionReport,
  byProperty,
  programmeSuspects,
  unusedWindows,
} from '../../src/quality/exceptions.js';
import { readProgramme } from '../../src/program/window.js';
import { readChecks } from '../../src/mudcheck/record.js';

const programme = readProgramme({
  well: 'brazos 14-3',
  sections: [
    {
      name: 'intermediate',
      fromFeet: 6000,
      toFeet: 11000,
      limits: {
        weightPpg: { min: 12, max: 12.8 },
        plasticViscosity: { max: 24 },
        filtrateApiMl: { max: 6 },
      },
    },
  ],
});

const checks = readChecks(
  [12.4, 12.5, 12.6, 12.7, 12.9, 13.1].map((weight, index) => ({
    well: 'brazos 14-3',
    date: `2024-11-0${index + 1}`,
    depthFeet: 9000 + index * 200,
    weightPpg: weight,
    dials: { 600: 60 + index * 4, 300: 38 + index * 2 },
    filtrate: { apiMl: 4.8 },
  }))
);

describe('judgeable', () => {
  it('works the rheology out where the dials are there', () => {
    expect(judgeable(checks[0]).plasticViscosity).toBe(22);
  });

  it('leaves it null where they are not', () => {
    expect(judgeable({ weightPpg: 12.4 }).plasticViscosity).toBe(null);
  });

  it('reaches into the filtrate and the retort', () => {
    expect(judgeable(checks[0]).filtrateApiMl).toBe(4.8);
    expect(judgeable(checks[0]).solidsPercent).toBe(null);
  });
});

describe('exceptionReport', () => {
  const report = exceptionReport(checks, programme);

  it('judges every check against its own section', () => {
    expect(report.judged).toBe(6);
    expect(report.checks.every((row) => row.section === 'intermediate')).toBe(true);
  });

  it('counts the checks that fell outside', () => {
    expect(report.outside).toBeGreaterThan(0);
    expect(report.outsideShare).toBe(Math.round((report.outside / 6) * 1000) / 1000);
  });

  it('marks a check taken below the deepest section', () => {
    const deep = exceptionReport(
      readChecks([{ well: 'x', date: '2024-11-09', depthFeet: 12000, weightPpg: 13 }]),
      programme
    );
    expect(deep.checks[0].offProgramme).toBe(true);
    expect(deep.judged).toBe(0);
    expect(deep.outsideShare).toBe(0);
  });

  it('carries the date and depth of each check', () => {
    expect(report.checks[0]).toMatchObject({ date: '2024-11-01', depthFeet: 9000 });
  });
});

describe('byProperty', () => {
  const rows = byProperty(exceptionReport(checks, programme));

  it('counts how often each property was out', () => {
    const weight = rows.find((row) => row.property === 'weightPpg');
    expect(weight.times).toBe(2);
    expect(weight.above).toBe(2);
    expect(weight.below).toBe(0);
  });

  it('reports the worst miss', () => {
    expect(rows.find((row) => row.property === 'weightPpg').worst).toBeCloseTo(0.3, 6);
  });

  it('leaves out a property that was never breached', () => {
    expect(rows.map((row) => row.property)).not.toContain('filtrateApiMl');
  });

  it('sorts by how often, worst first', () => {
    const times = rows.map((row) => row.times);
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});

describe('programmeSuspects', () => {
  it('leaves a property that is only out now and then alone', () => {
    const suspects = programmeSuspects(exceptionReport(checks, programme));
    expect(suspects.map((row) => row.property)).not.toContain('weightPpg');
  });

  it('names a property the well is out on more often than not', () => {
    const suspects = programmeSuspects(exceptionReport(checks, programme));
    expect(suspects.map((row) => row.property)).toContain('plasticViscosity');
  });

  it('names a window the well never met', () => {
    const tight = readProgramme({
      well: 'brazos 14-3',
      sections: [
        {
          name: 'intermediate',
          fromFeet: 6000,
          toFeet: 11000,
          limits: { weightPpg: { max: 12.2 } },
        },
      ],
    });
    const suspects = programmeSuspects(exceptionReport(checks, tight));
    expect(suspects).toHaveLength(1);
    expect(suspects[0]).toMatchObject({ property: 'weightPpg', side: 'above' });
    expect(suspects[0].reason).toMatch(/always above/);
  });

  it('leaves a property that goes out both ways alone', () => {
    const narrow = readProgramme({
      well: 'brazos 14-3',
      sections: [
        {
          name: 'intermediate',
          fromFeet: 6000,
          toFeet: 11000,
          limits: { weightPpg: { min: 12.5, max: 12.6 } },
        },
      ],
    });
    expect(programmeSuspects(exceptionReport(checks, narrow))).toEqual([]);
  });
});

describe('unusedWindows', () => {
  it('lists the properties the programme says nothing about', () => {
    const unused = unusedWindows(programme);
    expect(unused).toContain('ph');
    expect(unused).toContain('sandPercent');
    expect(unused).not.toContain('weightPpg');
  });
});
