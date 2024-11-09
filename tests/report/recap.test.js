import { describe, it, expect } from 'vitest';
import { buildRecap, renderRecap } from '../../src/report/recap.js';
import { readProgramme } from '../../src/program/window.js';
import { dayCost } from '../../src/cost/daily.js';

const checks = [12.1, 12.2, 12.2, 12.3, 12.4, 12.6].map((weight, index) => ({
  well: 'brazos 14-3',
  date: `2024-12-1${index}`,
  depthFeet: 9000 + index * 250,
  weightPpg: weight,
  funnelSeconds: 44 + index,
  dials: { 600: 60 + index, 300: 38 + index },
  filtrate: { apiMl: 5 + index * 0.2 },
}));

const programme = readProgramme({
  well: 'brazos 14-3',
  sections: [
    {
      name: 'intermediate',
      fromFeet: 6000,
      toFeet: 11000,
      limits: { weightPpg: { min: 12, max: 12.5 }, filtrateApiMl: { max: 6 } },
    },
  ],
});

const products = [
  { code: 'BAR', name: 'barite', unit: 'sack', pricePerUnit: 16, category: 'weighting' },
];
const days = [
  dayCost({
    date: '2024-12-10',
    products,
    used: { BAR: 120 },
    footageFeet: 250,
    serviceCharge: 1450,
  }),
  dayCost({
    date: '2024-12-11',
    products,
    used: { BAR: 90 },
    footageFeet: 250,
    serviceCharge: 1450,
  }),
];

describe('buildRecap', () => {
  const recap = buildRecap({ well: 'brazos 14-3', checks, programme, days });

  it('spans the checks it was given', () => {
    expect(recap.from).toBe('2024-12-10');
    expect(recap.to).toBe('2024-12-15');
    expect(recap.days).toBe(6);
    expect(recap.checks).toBe(6);
  });

  it('reports where the weight started, ended and ranged', () => {
    expect(recap.weight.start).toBe(12.1);
    expect(recap.weight.end).toBe(12.6);
    expect(recap.weight.lowest).toBe(12.1);
    expect(recap.weight.highest).toBe(12.6);
  });

  it('charts the weight when there are enough checks', () => {
    expect(recap.control.property).toBe('weightPpg');
  });

  it('does not chart it when there are not', () => {
    expect(buildRecap({ well: 'x', checks: [checks[0], checks[1]] }).control).toBe(null);
  });

  it('judges against the programme when there is one', () => {
    expect(recap.exceptions.judged).toBe(6);
    expect(recap.exceptionsByProperty.length).toBeGreaterThan(0);
  });

  it('leaves the programme block out when there is none', () => {
    const bare = buildRecap({ well: 'x', checks });
    expect(bare.exceptions).toBe(null);
    expect(bare.suspects).toEqual([]);
  });

  it('finds the days with no check on them', () => {
    const gapped = buildRecap({
      well: 'x',
      checks: [checks[0], checks[3]],
    });
    expect(gapped.missingCheckDays).toEqual(['2024-12-11', '2024-12-12']);
  });

  it('totals the cost when the days are given', () => {
    expect(recap.costs.totalFootage).toBe(500);
    expect(recap.costSplit[0].category).toBe('weighting');
  });

  it('refuses a recap with no checks', () => {
    expect(() => buildRecap({ well: 'x', checks: [] })).toThrow(/at least one mud check/);
  });
});

describe('renderRecap', () => {
  const text = renderRecap(buildRecap({ well: 'brazos 14-3', checks, programme, days })).join('\n');

  it('prints each block', () => {
    for (const block of [
      'WELL RECAP',
      'MUD WEIGHT',
      'WHAT MOVED',
      'AGAINST THE PROGRAMME',
      'COST',
    ]) {
      expect(text).toContain(block);
    }
  });

  it('says whether the weight was in control', () => {
    expect(text).toMatch(/in control\s+(yes|no)/);
  });

  it('leaves the cost block out when no days were given', () => {
    const without = renderRecap(buildRecap({ well: 'x', checks })).join('\n');
    expect(without).not.toContain('COST');
  });

  it('names the days with no check', () => {
    const gapped = renderRecap(buildRecap({ well: 'x', checks: [checks[0], checks[3]] })).join(
      '\n'
    );
    expect(gapped).toContain('DAYS WITH NO CHECK');
    expect(gapped).toContain('2024-12-11');
  });

  it('says so when there are not enough checks to chart', () => {
    const thin = renderRecap(buildRecap({ well: 'x', checks: [checks[0], checks[1]] })).join('\n');
    expect(thin).toContain('not enough checks');
  });
});
