import { describe, it, expect } from 'vitest';
import {
  rockVolume,
  retentionOnCuttings,
  haulLoads,
  dischargeCost,
  haulReconciliation,
} from '../../src/waste/cuttings.js';
import { round } from '../../src/util/number.js';

describe('rockVolume', () => {
  it('is the hole the bit made', () => {
    expect(round(rockVolume({ bitDiameterInches: 8.5, footageFeet: 1000 }), 1)).toBe(70.2);
  });

  it('grows with washout', () => {
    expect(
      rockVolume({ bitDiameterInches: 8.5, footageFeet: 1000, washoutFraction: 0.15 })
    ).toBeCloseTo(rockVolume({ bitDiameterInches: 8.5, footageFeet: 1000 }) * 1.15, 6);
  });

  it('is nothing over no footage', () => {
    expect(rockVolume({ bitDiameterInches: 8.5, footageFeet: 0 })).toBe(0);
  });
});

describe('retentionOnCuttings', () => {
  it('works the mud out of the liquid share of the discharge', () => {
    const held = retentionOnCuttings({ rockBbl: 70.2, liquidShare: 0.4 });
    expect(held.mudBbl).toBe(46.8);
    expect(held.dischargeBbl).toBe(117);
    expect(held.mudPerRock).toBe(0.667);
  });

  it('carries nothing on a perfectly dry discharge', () => {
    expect(retentionOnCuttings({ rockBbl: 70.2, liquidShare: 0 }).mudBbl).toBe(0);
  });

  it('runs away as the discharge gets wetter', () => {
    const dry = retentionOnCuttings({ rockBbl: 70.2, liquidShare: 0.3 });
    const wet = retentionOnCuttings({ rockBbl: 70.2, liquidShare: 0.6 });
    expect(wet.mudBbl).toBeGreaterThan(dry.mudBbl * 3);
  });

  it('refuses a discharge that is all liquid', () => {
    expect(() => retentionOnCuttings({ rockBbl: 70.2, liquidShare: 1 })).toThrow(
      /all liquid is not cuttings/
    );
  });
});

describe('haulLoads', () => {
  it('rounds a part load up, because the truck still comes', () => {
    expect(haulLoads({ dischargeBbl: 117, skipBbl: 40 }).loads).toBe(3);
  });

  it('reports how full the last load is', () => {
    expect(haulLoads({ dischargeBbl: 117, skipBbl: 40 }).lastLoadShare).toBe(0.925);
    expect(haulLoads({ dischargeBbl: 120, skipBbl: 40 }).lastLoadShare).toBe(1);
  });

  it('is no loads at all for nothing', () => {
    expect(haulLoads({ dischargeBbl: 0, skipBbl: 40 })).toEqual({ loads: 0, lastLoadShare: 0 });
  });

  it('refuses a skip with no capacity', () => {
    expect(() => haulLoads({ dischargeBbl: 117, skipBbl: 0 })).toThrow(/above zero/);
  });
});

describe('dischargeCost', () => {
  const cost = dischargeCost({
    rockBbl: 70.2,
    liquidShare: 0.4,
    mudCostPerBbl: 38,
    haulCostPerLoad: 450,
    skipBbl: 40,
    disposalCostPerBbl: 6,
  });

  it('counts mud, haulage and disposal', () => {
    expect(cost.mudCost).toBe(1778.4);
    expect(cost.haulCost).toBe(1350);
    expect(cost.disposalCost).toBe(702);
    expect(cost.totalCost).toBe(3830.4);
  });

  it('shows the mud on the cuttings costing as much as the trucks', () => {
    expect(cost.mudCost).toBeGreaterThan(cost.haulCost * 0.9);
  });

  it('falls sharply when the discharge is drier', () => {
    const drier = dischargeCost({
      rockBbl: 70.2,
      liquidShare: 0.2,
      mudCostPerBbl: 38,
      haulCostPerLoad: 450,
      skipBbl: 40,
      disposalCostPerBbl: 6,
    });
    expect(drier.totalCost).toBeLessThan(cost.totalCost * 0.7);
  });
});

describe('haulReconciliation', () => {
  const tickets = [{ barrels: 40 }, { barrels: 40 }, { barrels: 37 }];

  it('totals the tickets against what the hole made', () => {
    const check = haulReconciliation({ tickets, expectedDischargeBbl: 117 });
    expect(check.hauledBbl).toBe(117);
    expect(check.verdict).toBe('as expected');
    expect(check.investigate).toBe(false);
  });

  it('flags more going out than the hole made', () => {
    const check = haulReconciliation({ tickets, expectedDischargeBbl: 80 });
    expect(check.verdict).toMatch(/more went out/);
    expect(check.investigate).toBe(true);
  });

  it('flags less going out than the hole made', () => {
    const check = haulReconciliation({ tickets, expectedDischargeBbl: 200 });
    expect(check.verdict).toMatch(/less went out/);
  });

  it('takes a tighter tolerance', () => {
    const check = haulReconciliation({
      tickets,
      expectedDischargeBbl: 110,
      toleranceFraction: 0.02,
    });
    expect(check.investigate).toBe(true);
  });

  it('names the ticket that is wrong', () => {
    expect(() =>
      haulReconciliation({ tickets: [{ barrels: 40 }, {}], expectedDischargeBbl: 117 })
    ).toThrow(/ticket 2 barrels/);
  });

  it('refuses an empty book', () => {
    expect(() => haulReconciliation({ tickets: [], expectedDischargeBbl: 117 })).toThrow(
      /no haul tickets/
    );
  });
});
