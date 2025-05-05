import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSectionReport, renderSectionReport } from '../../src/report/section.js';
import { readChecks } from '../../src/mudcheck/record.js';
import { readProgramme } from '../../src/program/window.js';
import { dayCost } from '../../src/cost/daily.js';

const checks = readChecks(JSON.parse(readFileSync('examples/checks-brazos.json', 'utf8')));
const programme = readProgramme(JSON.parse(readFileSync('examples/programme-brazos.json', 'utf8')));
const section = programme.sections[1];

const products = [{ code: 'BAR', name: 'barite', unit: 'sack', pricePerUnit: 16 }];
const days = [
  dayCost({
    date: '2024-08-18',
    products,
    used: { BAR: 120 },
    footageFeet: 420,
    serviceCharge: 1450,
  }),
  dayCost({
    date: '2024-08-19',
    products,
    used: { BAR: 260 },
    footageFeet: 400,
    serviceCharge: 1450,
  }),
];

describe('buildSectionReport', () => {
  const report = buildSectionReport({ section, checks, programme, days });

  it('takes only the checks inside the section', () => {
    expect(report.checks).toBe(checks.length);
    expect(report.fromFeet).toBe(6000);
  });

  it('reports where the weight started, ended and topped out', () => {
    expect(report.weight.start).toBe(12.1);
    expect(report.weight.end).toBe(12.4);
    expect(report.weight.highest).toBe(12.4);
  });

  it('counts the days the section took', () => {
    expect(report.days).toBe(6);
  });

  it('judges against the programme when there is one', () => {
    expect(report.exceptions.judged).toBe(checks.length);
    expect(report.worstProperties.length).toBeGreaterThan(0);
  });

  it('leaves the programme out when there is none', () => {
    const bare = buildSectionReport({ section, checks });
    expect(bare.exceptions).toBe(null);
    expect(bare.worstProperties).toEqual([]);
  });

  it('compares against the plan when one is given', () => {
    const planned = buildSectionReport({
      section,
      checks,
      days,
      planned: { productCost: 50000, costPerFoot: 11.2 },
    });
    expect(planned.againstPlan.overrun).toBeLessThan(0);
    expect(planned.againstPlan.plannedPerFoot).toBe(11.2);
  });

  it('leaves the comparison out with no plan', () => {
    expect(buildSectionReport({ section, checks, days }).againstPlan).toBe(null);
  });

  it('refuses a section with no checks in it', () => {
    expect(() =>
      buildSectionReport({
        section: { name: 'production', fromFeet: 11000, toFeet: 14000 },
        checks,
      })
    ).toThrow(/no checks between 11000 and 14000/);
  });
});

describe('renderSectionReport', () => {
  const text = renderSectionReport(buildSectionReport({ section, checks, programme, days })).join(
    '\n'
  );

  it('prints each block', () => {
    expect(text).toContain('SECTION REPORT INTERMEDIATE');
    expect(text).toContain('MUD WEIGHT');
    expect(text).toContain('AGAINST THE PROGRAMME');
    expect(text).toContain('COST');
  });

  it('names what the section was worst on', () => {
    expect(text).toMatch(/worst on/);
  });

  it('prints the plan comparison when there is one', () => {
    const planned = renderSectionReport(
      buildSectionReport({
        section,
        checks,
        days,
        planned: { productCost: 50000, costPerFoot: 11.2 },
      })
    ).join('\n');
    expect(planned).toContain('AGAINST THE PLAN');
    expect(planned).not.toContain('\nCOST\n');
  });

  it('leaves the cost out with no days', () => {
    const without = renderSectionReport(buildSectionReport({ section, checks })).join('\n');
    expect(without).not.toContain('COST');
  });
});
