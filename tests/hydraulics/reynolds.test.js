import { describe, it, expect } from 'vitest';
import {
  PIPE_REYNOLDS_CONSTANT,
  ANNULAR_REYNOLDS_CONSTANT,
  CONSISTENCY_TO_CENTIPOISE,
  reynoldsPipe,
  reynoldsAnnulus,
  criticalReynolds,
  regime,
  frictionFactor,
  describeFlow,
} from '../../src/hydraulics/reynolds.js';
import { round } from '../../src/util/number.js';

const pipeModel = { n: 0.6077, k: 1.014 };
const annularModel = { n: 0.4352, k: 2.6258 };

describe('reynoldsPipe', () => {
  it('uses the api form constants', () => {
    expect(PIPE_REYNOLDS_CONSTANT).toBe(89100);
    expect(ANNULAR_REYNOLDS_CONSTANT).toBe(109000);
    expect(CONSISTENCY_TO_CENTIPOISE).toBe(478.8);
  });

  it('reads a working drill pipe flow', () => {
    const re = reynoldsPipe({
      densityPpg: 12.4,
      velocityFeetPerSecond: 13.4,
      idInches: 4.276,
      model: pipeModel,
    });
    expect(round(re, 0)).toBe(11623);
  });

  it('reduces to the newtonian number for water', () => {
    const re = reynoldsPipe({
      densityPpg: 8.33,
      velocityFeetPerSecond: 13.4,
      idInches: 4.276,
      model: { n: 1, k: 1 / CONSISTENCY_TO_CENTIPOISE },
    });
    expect(re).toBeCloseTo(928 * 8.33 * 13.4 * 4.276, -4);
  });

  it('is zero with the pump off', () => {
    expect(
      reynoldsPipe({
        densityPpg: 12.4,
        velocityFeetPerSecond: 0,
        idInches: 4.276,
        model: pipeModel,
      })
    ).toBe(0);
  });

  it('refuses a model with no constants', () => {
    expect(() =>
      reynoldsPipe({ densityPpg: 12.4, velocityFeetPerSecond: 13.4, idInches: 4.276, model: {} })
    ).toThrow(/n/);
  });
});

describe('reynoldsAnnulus', () => {
  it('reads a working annular flow, which is far lower', () => {
    const re = reynoldsAnnulus({
      densityPpg: 12.4,
      velocityFeetPerSecond: 5.185,
      holeIdInches: 8.5,
      pipeOdInches: 5,
      model: annularModel,
    });
    expect(round(re, 0)).toBe(2394);
  });

  it('is zero with the pump off', () => {
    expect(
      reynoldsAnnulus({
        densityPpg: 12.4,
        velocityFeetPerSecond: 0,
        holeIdInches: 8.5,
        pipeOdInches: 5,
        model: annularModel,
      })
    ).toBe(0);
  });

  it('refuses a string that does not fit', () => {
    expect(() =>
      reynoldsAnnulus({
        densityPpg: 12.4,
        velocityFeetPerSecond: 5,
        holeIdInches: 8.5,
        pipeOdInches: 9,
        model: annularModel,
      })
    ).toThrow(/does not fit/);
  });
});

describe('criticalReynolds', () => {
  it('moves with the flow behaviour index', () => {
    expect(criticalReynolds(1)).toEqual({ laminarUpTo: 2100, turbulentFrom: 2900 });
    expect(round(criticalReynolds(0.6077).laminarUpTo, 0)).toBe(2637);
    expect(round(criticalReynolds(0.6077).turbulentFrom, 0)).toBe(3437);
  });

  it('keeps a shear thinning fluid laminar longer than water', () => {
    expect(criticalReynolds(0.4).laminarUpTo).toBeGreaterThan(criticalReynolds(1).laminarUpTo);
  });
});

describe('regime', () => {
  it('calls the three regimes', () => {
    expect(regime(1000, 0.6077)).toBe('laminar');
    expect(regime(3000, 0.6077)).toBe('transitional');
    expect(regime(11623, 0.6077)).toBe('turbulent');
  });

  it('takes each edge inclusively', () => {
    expect(regime(criticalReynolds(0.6).laminarUpTo, 0.6)).toBe('laminar');
    expect(regime(criticalReynolds(0.6).turbulentFrom, 0.6)).toBe('turbulent');
  });
});

describe('frictionFactor', () => {
  it('is sixteen over the number in laminar flow', () => {
    expect(frictionFactor(1000, 0.6077)).toBeCloseTo(0.016, 10);
  });

  it('follows dodge and metzner in turbulent flow', () => {
    expect(round(frictionFactor(11623, 0.6077), 5)).toBe(0.00536);
  });

  it('blends across the transition rather than stepping', () => {
    const n = 0.6077;
    const { laminarUpTo, turbulentFrom } = criticalReynolds(n);
    const justBelow = frictionFactor(laminarUpTo - 0.01, n);
    const atEdge = frictionFactor(laminarUpTo + 0.01, n);
    expect(Math.abs(justBelow - atEdge)).toBeLessThan(1e-4);
    const justUnder = frictionFactor(turbulentFrom - 0.01, n);
    const atTop = frictionFactor(turbulentFrom + 0.01, n);
    expect(Math.abs(justUnder - atTop)).toBeLessThan(1e-4);
  });

  it('climbs across the transition, as a real fluid does', () => {
    const n = 0.6077;
    const { laminarUpTo, turbulentFrom } = criticalReynolds(n);
    expect(frictionFactor(turbulentFrom, n)).toBeGreaterThan(frictionFactor(laminarUpTo, n));
  });

  it('falls again once the flow is fully turbulent', () => {
    const n = 0.6077;
    let previous = frictionFactor(4000, n);
    for (let re = 5000; re <= 40000; re += 5000) {
      const next = frictionFactor(re, n);
      expect(next).toBeLessThan(previous);
      previous = next;
    }
  });

  it('is zero with no flow', () => {
    expect(frictionFactor(0, 0.6)).toBe(0);
  });
});

describe('describeFlow', () => {
  it('is the regime block for one length of hole', () => {
    expect(describeFlow(11623, 0.6077)).toEqual({
      reynolds: 11623,
      regime: 'turbulent',
      frictionFactor: 0.00536,
      laminarUpTo: 2637.451,
      turbulentFrom: 3437.451,
    });
  });
});
