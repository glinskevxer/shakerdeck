import { describe, it, expect } from 'vitest';
import {
  utilisation,
  spreadUtilisation,
  downtimeReasons,
  effectiveRemoval,
  idleCost,
} from '../../src/solidscontrol/utilisation.js';

const equipment = [
  {
    name: 'shakers',
    hoursRun: 700,
    hoursAvailable: 720,
    downtime: [{ reason: 'screen change', hours: 12 }],
  },
  {
    name: 'desilter',
    hoursRun: 480,
    hoursAvailable: 720,
    downtime: [{ reason: 'cones plugged', hours: 40 }],
  },
  {
    name: 'centrifuge',
    hoursRun: 216,
    hoursAvailable: 720,
    downtime: [
      { reason: 'no operator', hours: 200 },
      { reason: 'gearbox', hours: 60 },
    ],
  },
];

describe('utilisation', () => {
  it('reads the hours as a share of what was available', () => {
    const shakers = utilisation(equipment[0]);
    expect(shakers.utilisation).toBeCloseTo(0.972, 3);
    expect(shakers.hoursIdle).toBe(20);
  });

  it('totals the downtime recorded against it', () => {
    expect(utilisation(equipment[2]).hoursDown).toBe(260);
  });

  it('names downtime that was not given a reason', () => {
    expect(
      utilisation({ name: 'x', hoursRun: 10, hoursAvailable: 20, downtime: [{ hours: 4 }] })
        .downtime[0].reason
    ).toBe('not recorded');
  });

  it('refuses more hours run than were available', () => {
    expect(() => utilisation({ name: 'shakers', hoursRun: 800, hoursAvailable: 720 })).toThrow(
      /ran for 800 hours out of 720/
    );
  });

  it('names the field that is wrong', () => {
    expect(() => utilisation({ name: 'shakers', hoursAvailable: 720 })).toThrow(/shakers hoursRun/);
  });
});

describe('spreadUtilisation', () => {
  const rows = spreadUtilisation(equipment);

  it('puts the worst first', () => {
    expect(rows[0].name).toBe('centrifuge');
    expect(rows.at(-1).name).toBe('shakers');
  });

  it('reads every piece of equipment', () => {
    expect(rows).toHaveLength(3);
  });
});

describe('downtimeReasons', () => {
  const reasons = downtimeReasons(spreadUtilisation(equipment));

  it('adds the hours up by reason', () => {
    expect(reasons[0].reason).toBe('no operator');
    expect(reasons[0].hours).toBe(200);
  });

  it('shares add to one', () => {
    expect(reasons.reduce((total, row) => total + row.share, 0)).toBeCloseTo(1, 2);
  });

  it('is nothing at all when nothing was down', () => {
    expect(
      downtimeReasons(spreadUtilisation([{ name: 'x', hoursRun: 10, hoursAvailable: 20 }]))
    ).toEqual([]);
  });
});

describe('effectiveRemoval', () => {
  const rows = spreadUtilisation(equipment);

  it('cuts the rated removal by how much the spread actually ran', () => {
    const effective = effectiveRemoval({ ratedShare: 0.7, rows });
    expect(effective.effectiveShare).toBeLessThan(0.7);
    expect(effective.effectiveShare).toBeCloseTo(0.7 * effective.averageUtilisation, 3);
  });

  it('loses nothing when everything ran the whole time', () => {
    const perfect = effectiveRemoval({
      ratedShare: 0.7,
      rows: spreadUtilisation([{ name: 'x', hoursRun: 720, hoursAvailable: 720 }]),
    });
    expect(perfect.effectiveShare).toBe(0.7);
    expect(perfect.lostShare).toBe(0);
  });

  it('refuses an empty spread', () => {
    expect(() => effectiveRemoval({ ratedShare: 0.7, rows: [] })).toThrow(/no equipment/);
  });
});

describe('idleCost', () => {
  const rows = spreadUtilisation(equipment);

  it('costs the idle hours at the rental rate', () => {
    const cost = idleCost({
      rows,
      ratesPerDay: { centrifuge: 450, desilter: 180, shakers: 0 },
    });
    expect(cost[0].name).toBe('centrifuge');
    expect(cost[0].cost).toBeGreaterThan(0);
  });

  it('costs nothing for equipment with no rate on file', () => {
    const cost = idleCost({ rows, ratesPerDay: {} });
    expect(cost.every((row) => row.cost === 0)).toBe(true);
  });

  it('sorts by what the idle time cost', () => {
    const cost = idleCost({ rows, ratesPerDay: { centrifuge: 450, desilter: 180 } });
    const values = cost.map((row) => row.cost);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });
});
