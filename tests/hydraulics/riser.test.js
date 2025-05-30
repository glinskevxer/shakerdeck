import { describe, it, expect } from 'vitest';
import {
  SEAWATER_PPG,
  belowMudLine,
  riserMargin,
  disconnectedPressure,
  marginCheck,
  chokeLineFriction,
} from '../../src/hydraulics/riser.js';

const deepWater = {
  mudPpg: 12.4,
  totalTvdFeet: 14000,
  waterDepthFeet: 5000,
  airGapFeet: 75,
};

describe('belowMudLine', () => {
  it('takes the water and the air gap off the total', () => {
    expect(belowMudLine(deepWater)).toBe(8925);
  });

  it('is the whole depth on a land well', () => {
    expect(belowMudLine({ totalTvdFeet: 10000, waterDepthFeet: 0 })).toBe(10000);
  });

  it('refuses a well with no hole in it', () => {
    expect(() => belowMudLine({ totalTvdFeet: 5000, waterDepthFeet: 5000 })).toThrow(
      /no hole in it/
    );
  });
});

describe('riserMargin', () => {
  it('is a large number in deep water', () => {
    expect(SEAWATER_PPG).toBe(8.55);
    expect(riserMargin(deepWater)).toBeGreaterThan(2);
  });

  it('is nothing on a land well', () => {
    expect(riserMargin({ mudPpg: 12.4, totalTvdFeet: 10000, waterDepthFeet: 0 })).toBe(0);
  });

  it('grows with the water depth', () => {
    expect(riserMargin({ ...deepWater, waterDepthFeet: 8000 })).toBeGreaterThan(
      riserMargin(deepWater)
    );
  });

  it('grows with the mud weight', () => {
    expect(riserMargin({ ...deepWater, mudPpg: 16 })).toBeGreaterThan(riserMargin(deepWater));
  });

  it('is nothing when the mud is seawater', () => {
    expect(riserMargin({ ...deepWater, mudPpg: SEAWATER_PPG })).toBe(0);
  });
});

describe('disconnectedPressure', () => {
  const pressure = disconnectedPressure(deepWater);

  it('loses pressure when the riser goes', () => {
    expect(pressure.disconnectedPsi).toBeLessThan(pressure.connectedPsi);
    expect(pressure.lostPsi).toBeGreaterThan(0);
  });

  it('reports the loss as an equivalent weight at total depth', () => {
    expect(pressure.equivalentPpg).toBeGreaterThan(1);
    expect(pressure.equivalentPpg).toBeLessThan(riserMargin(deepWater));
  });

  it('loses nothing on a land well', () => {
    expect(
      disconnectedPressure({ mudPpg: 12.4, totalTvdFeet: 10000, waterDepthFeet: 0 }).lostPsi
    ).toBe(0);
  });
});

describe('marginCheck', () => {
  it('says the mud does not carry the margin on a tight overbalance', () => {
    const check = marginCheck({ ...deepWater, porePressurePpg: 11.9 });
    expect(check.carriesTheMargin).toBe(false);
    expect(check.shortByPpg).toBeGreaterThan(0);
  });

  it('says it does on a wide one', () => {
    const check = marginCheck({ ...deepWater, porePressurePpg: 9 });
    expect(check.carriesTheMargin).toBe(true);
    expect(check.shortByPpg).toBe(0);
  });

  it('always carries it on a land well', () => {
    expect(
      marginCheck({
        mudPpg: 12.4,
        porePressurePpg: 12.3,
        totalTvdFeet: 10000,
        waterDepthFeet: 0,
      }).carriesTheMargin
    ).toBe(true);
  });
});

describe('chokeLineFriction', () => {
  it('turns the friction into an equivalent weight at the shoe', () => {
    expect(chokeLineFriction({ frictionPsi: 400, shoeTvdFeet: 8000 })).toBeCloseTo(0.962, 3);
  });

  it('is nothing with no friction', () => {
    expect(chokeLineFriction({ frictionPsi: 0, shoeTvdFeet: 8000 })).toBe(0);
  });

  it('matters far more with a shallow shoe', () => {
    expect(chokeLineFriction({ frictionPsi: 400, shoeTvdFeet: 6000 })).toBeGreaterThan(
      chokeLineFriction({ frictionPsi: 400, shoeTvdFeet: 8000 })
    );
  });
});
