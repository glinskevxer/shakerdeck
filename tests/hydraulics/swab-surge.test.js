import { describe, it, expect } from 'vitest';
import {
  CLINGING_CONSTANT,
  effectiveVelocity,
  pipeSpeed,
  tripPressure,
  tripEquivalentWeight,
  safeTripSpeed,
} from '../../src/hydraulics/swab-surge.js';

const model = { n: 0.4352, k: 2.6258 };
const rows = [
  { holeName: 'casing', pipeName: 'drill pipe', idInches: 8.681, odInches: 5, lengthFeet: 6000 },
  { holeName: 'open hole', pipeName: 'drill pipe', idInches: 8.5, odInches: 5, lengthFeet: 3400 },
  { holeName: 'open hole', pipeName: 'collars', idInches: 8.5, odInches: 6.5, lengthFeet: 600 },
];

describe('pipeSpeed', () => {
  it('works a stand a minute out', () => {
    expect(pipeSpeed({ standLengthFeet: 93, secondsPerStand: 60 })).toBe(93);
  });

  it('doubles when the stand comes out in half the time', () => {
    expect(pipeSpeed({ standLengthFeet: 93, secondsPerStand: 30 })).toBe(186);
  });

  it('refuses a stand that takes no time at all', () => {
    expect(() => pipeSpeed({ standLengthFeet: 93, secondsPerStand: 0 })).toThrow(/above zero/);
  });
});

describe('effectiveVelocity', () => {
  it('carries the usual clinging constant', () => {
    expect(CLINGING_CONSTANT).toBe(0.45);
  });

  it('drags a layer along with an open ended string', () => {
    expect(
      effectiveVelocity({ pipeSpeedFeetPerMinute: 93, holeIdInches: 8.5, pipeOdInches: 5 })
    ).toBeCloseTo(41.85, 6);
  });

  it('pushes far more with a float in the string', () => {
    const open = effectiveVelocity({
      pipeSpeedFeetPerMinute: 93,
      holeIdInches: 8.5,
      pipeOdInches: 5,
    });
    const closed = effectiveVelocity({
      pipeSpeedFeetPerMinute: 93,
      holeIdInches: 8.5,
      pipeOdInches: 5,
      closedEnd: true,
    });
    expect(closed).toBeGreaterThan(open * 2);
  });

  it('is nothing with the pipe hanging still', () => {
    expect(
      effectiveVelocity({ pipeSpeedFeetPerMinute: 0, holeIdInches: 8.5, pipeOdInches: 5 })
    ).toBe(0);
  });

  it('refuses a string that does not fit', () => {
    expect(() =>
      effectiveVelocity({ pipeSpeedFeetPerMinute: 93, holeIdInches: 5, pipeOdInches: 5 })
    ).toThrow(/does not fit/);
  });
});

describe('tripPressure', () => {
  const surge = tripPressure({
    rows,
    pipeSpeedFeetPerMinute: 93,
    densityPpg: 12.4,
    model,
    direction: 'in',
  });

  it('comes back positive going in', () => {
    expect(surge.pressurePsi).toBe(130);
    expect(surge.direction).toBe('in');
  });

  it('comes back negative coming out', () => {
    const swab = tripPressure({
      rows,
      pipeSpeedFeetPerMinute: 93,
      densityPpg: 12.4,
      model,
      direction: 'out',
    });
    expect(swab.pressurePsi).toBe(-130);
  });

  it('reports a length at a time', () => {
    expect(surge.sections).toHaveLength(3);
    expect(surge.sections[2].holeName).toBe('open hole');
  });

  it('climbs with speed, but far less than in proportion', () => {
    const fast = tripPressure({
      rows,
      pipeSpeedFeetPerMinute: 186,
      densityPpg: 12.4,
      model,
      direction: 'in',
    });
    expect(fast.pressurePsi).toBeGreaterThan(surge.pressurePsi);
    expect(fast.pressurePsi).toBeLessThan(surge.pressurePsi * 2);
  });

  it('is worse with a float in the string', () => {
    const closed = tripPressure({
      rows,
      pipeSpeedFeetPerMinute: 93,
      densityPpg: 12.4,
      model,
      direction: 'in',
      closedEnd: true,
    });
    expect(closed.pressurePsi).toBeGreaterThan(surge.pressurePsi * 1.4);
  });

  it('refuses a direction that is not a trip', () => {
    expect(() =>
      tripPressure({
        rows,
        pipeSpeedFeetPerMinute: 93,
        densityPpg: 12.4,
        model,
        direction: 'sideways',
      })
    ).toThrow(/goes in or out/);
  });
});

describe('tripEquivalentWeight', () => {
  it('adds the surge to the mud weight', () => {
    expect(tripEquivalentWeight({ weightPpg: 12.4, pressurePsi: 130, tvdFeet: 10000 })).toBe(12.65);
  });

  it('takes the swab off it', () => {
    expect(tripEquivalentWeight({ weightPpg: 12.4, pressurePsi: -130, tvdFeet: 10000 })).toBe(
      12.15
    );
  });

  it('matters far more in a shallow hole', () => {
    expect(
      tripEquivalentWeight({ weightPpg: 12.4, pressurePsi: 130, tvdFeet: 3000 })
    ).toBeGreaterThan(13);
  });
});

describe('safeTripSpeed', () => {
  it('finds the speed that lands on a swab limit', () => {
    const speed = safeTripSpeed({
      rows,
      densityPpg: 12.4,
      model,
      tvdFeet: 10000,
      weightPpg: 12.4,
      limitPpg: 11.9,
      direction: 'out',
    });
    expect(speed.feetPerMinute).toBe(468);
    expect(speed.equivalentWeightPpg).toBeGreaterThanOrEqual(11.9);
  });

  it('says the limit is never reached when the window is wide', () => {
    const speed = safeTripSpeed({
      rows,
      densityPpg: 12.4,
      model,
      tvdFeet: 10000,
      weightPpg: 12.4,
      limitPpg: 14,
      direction: 'in',
    });
    expect(speed.feetPerMinute).toBe(600);
    expect(speed.limited).toBe(null);
  });

  it('says so when the pipe cannot be moved at all', () => {
    const speed = safeTripSpeed({
      rows,
      densityPpg: 12.4,
      model,
      tvdFeet: 10000,
      weightPpg: 12.4,
      limitPpg: 12.4001,
      direction: 'in',
    });
    expect(speed.feetPerMinute).toBe(0);
    expect(speed.limited).toMatch(/any speed/);
  });
});
