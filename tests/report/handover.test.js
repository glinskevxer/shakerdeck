import { describe, it, expect } from 'vitest';
import { buildHandover, renderHandover, firstThing } from '../../src/report/handover.js';
import { readChecks } from '../../src/mudcheck/record.js';
import { readProgramme } from '../../src/program/window.js';

const checks = readChecks(
  [12.1, 12.2, 12.3, 12.4, 12.5, 12.6].map((weight, index) => ({
    well: 'brazos 14-3',
    date: `2025-06-2${index}`,
    depthFeet: 9000 + index * 250,
    weightPpg: weight,
    funnelSeconds: 44 + index,
    dials: { 600: 60 + index * 2, 300: 38 + index },
  }))
);

const programme = readProgramme({
  well: 'brazos 14-3',
  sections: [
    {
      name: 'intermediate',
      fromFeet: 6000,
      toFeet: 11000,
      limits: { weightPpg: { min: 12, max: 12.4 } },
    },
  ],
});

const steadyChecks = readChecks(
  [12.4, 12.5, 12.4, 12.6, 12.5, 12.4].map((weight, index) => ({
    well: 'brazos 14-3',
    date: `2025-06-2${index}`,
    depthFeet: 9000 + index * 250,
    weightPpg: weight,
    funnelSeconds: 44 + (index % 2),
    dials: { 600: 60 + (index % 2), 300: 38 },
  }))
);

const base = {
  well: 'brazos 14-3',
  outgoing: 'the day hand',
  incoming: 'the night hand',
  date: '2025-06-26',
  checks,
};

describe('buildHandover', () => {
  const handover = buildHandover({ ...base, programme });

  it('covers the stretch it was given', () => {
    expect(handover.over.checks).toBe(6);
    expect(handover.over.from).toBe('2025-06-20');
  });

  it('names what moved', () => {
    expect(handover.movers.length).toBeGreaterThan(0);
    expect(handover.movers.map((row) => row.property)).toContain('weightPpg');
  });

  it('says what is outside the programme', () => {
    expect(handover.outOn).toContain('mud weight');
  });

  it('says nothing about the programme when there is none', () => {
    expect(buildHandover(base).outOn).toEqual([]);
  });

  it('carries the treatments that have not answered', () => {
    const handover2 = buildHandover({
      ...base,
      treatments: [
        { date: '2025-06-25', what: 'soda ash for the calcium', responded: false },
        { date: '2025-06-22', what: 'lime', responded: true },
      ],
    });
    expect(handover2.treatmentsPending).toHaveLength(1);
  });

  it('carries what is short', () => {
    const handover3 = buildHandover({
      ...base,
      stock: [
        { name: 'polyanionic cellulose', short: true, daysOfCover: 0.6 },
        { name: 'barite', short: false, daysOfCover: 9 },
      ],
    });
    expect(handover3.short).toHaveLength(1);
  });

  it('refuses a handover with nothing to compare', () => {
    expect(() => buildHandover({ ...base, checks: [checks[0]] })).toThrow(/at least two checks/);
  });
});

describe('renderHandover', () => {
  it('leads with who is handing over to whom', () => {
    const lines = renderHandover(buildHandover({ ...base, programme }));
    expect(lines[0]).toBe('HANDOVER BRAZOS 14-3');
    expect(lines.join('\n')).toContain('the day hand');
  });

  it('prints what is moving', () => {
    expect(renderHandover(buildHandover(base)).join('\n')).toContain('WHAT IS MOVING');
  });

  it('prints the open items when there are any', () => {
    const text = renderHandover(
      buildHandover({ ...base, openItems: ['the number two pump liner is due'] })
    ).join('\n');
    expect(text).toContain('OPEN');
    expect(text).toContain('number two pump liner');
  });

  it('leaves every block out when there is nothing in it', () => {
    const text = renderHandover(buildHandover(base)).join('\n');
    expect(text).not.toContain('SHORT');
    expect(text).not.toContain('OPEN');
    expect(text).not.toContain('OUTSIDE THE PROGRAMME');
  });
});

describe('firstThing', () => {
  it('puts a shortage first', () => {
    const handover = buildHandover({
      ...base,
      programme,
      stock: [{ name: 'polyanionic cellulose', short: true, daysOfCover: 0.6 }],
      treatments: [{ date: '2025-06-25', what: 'soda ash', responded: false }],
    });
    expect(firstThing(handover)).toMatch(/order polyanionic cellulose/);
  });

  it('puts a pending treatment next', () => {
    const handover = buildHandover({
      ...base,
      treatments: [{ date: '2025-06-25', what: 'soda ash', responded: false }],
    });
    expect(firstThing(handover)).toMatch(/soda ash/);
  });

  it('puts a chart that is out of control next', () => {
    expect(firstThing(buildHandover({ ...base, programme }))).toMatch(/out of control/);
  });

  it('falls back to the programme once the chart is settled', () => {
    expect(firstThing(buildHandover({ ...base, checks: steadyChecks, programme }))).toMatch(
      /outside the programme/
    );
  });

  it('says so when there is nothing outstanding', () => {
    expect(firstThing(buildHandover({ ...base, checks: steadyChecks }))).toBe(
      'nothing outstanding'
    );
  });
});
