import { describe, it, expect } from 'vitest';
import {
  CUTTINGS_SG,
  CUTTINGS_PPG,
  MOORE_LAMINAR,
  MOORE_TURBULENT,
  annularApparentViscosity,
  slipVelocity,
  transportRatio,
  cuttingsConcentration,
  holeCleaning,
} from '../../src/hydraulics/cuttings.js';
import { round } from '../../src/util/number.js';

const model = { n: 0.4352, k: 2.6258 };

describe('constants', () => {
  it('takes a cutting at the gravity of shale', () => {
    expect(CUTTINGS_SG).toBe(2.6);
    expect(round(CUTTINGS_PPG, 2)).toBe(21.7);
  });

  it('carries the laminar constant with the hundred already in it', () => {
    expect(MOORE_LAMINAR).toBe(8287);
    expect(MOORE_TURBULENT).toBe(113.4);
  });
});

describe('annularApparentViscosity', () => {
  it('reads the viscosity at the shear rate the flow is at', () => {
    expect(
      round(
        annularApparentViscosity({
          model,
          velocityFeetPerMinute: 311.1,
          holeIdInches: 8.5,
          pipeOdInches: 5,
        }),
        1
      )
    ).toBe(71.2);
  });

  it('reads far higher in a big hole at a slow rate', () => {
    const big = annularApparentViscosity({
      model,
      velocityFeetPerMinute: 45,
      holeIdInches: 12.25,
      pipeOdInches: 5,
    });
    expect(big).toBeGreaterThan(200);
  });

  it('refuses a pipe that does not fit', () => {
    expect(() =>
      annularApparentViscosity({
        model,
        velocityFeetPerMinute: 300,
        holeIdInches: 8.5,
        pipeOdInches: 8.5,
      })
    ).toThrow(/does not fit/);
  });
});

describe('slipVelocity', () => {
  it('lands in the intermediate regime on a working mud', () => {
    const slip = slipVelocity({
      cuttingDiameterInches: 0.25,
      mudWeightPpg: 12.4,
      apparentViscosityCp: 71.2,
    });
    expect(slip.regime).toBe('intermediate');
    expect(round(slip.velocityFeetPerMinute, 1)).toBe(20.1);
  });

  it('goes laminar in a very thick mud', () => {
    const slip = slipVelocity({
      cuttingDiameterInches: 0.1,
      mudWeightPpg: 12.4,
      apparentViscosityCp: 2000,
    });
    expect(slip.regime).toBe('laminar');
    expect(slip.particleReynolds).toBeLessThan(3);
  });

  it('goes turbulent in water', () => {
    const slip = slipVelocity({
      cuttingDiameterInches: 0.25,
      mudWeightPpg: 9,
      apparentViscosityCp: 2,
    });
    expect(slip.regime).toBe('turbulent');
    expect(slip.particleReynolds).toBeGreaterThan(300);
  });

  it('floats a cutting lighter than the mud', () => {
    const slip = slipVelocity({
      cuttingDiameterInches: 0.25,
      mudWeightPpg: 22,
      apparentViscosityCp: 30,
    });
    expect(slip.regime).toBe('floating');
    expect(slip.velocityFeetPerMinute).toBe(0);
  });

  it('drops a larger cutting faster', () => {
    const small = slipVelocity({
      cuttingDiameterInches: 0.1,
      mudWeightPpg: 12.4,
      apparentViscosityCp: 71.2,
    });
    const large = slipVelocity({
      cuttingDiameterInches: 0.5,
      mudWeightPpg: 12.4,
      apparentViscosityCp: 71.2,
    });
    expect(large.velocityFeetPerMinute).toBeGreaterThan(small.velocityFeetPerMinute);
  });
});

describe('transportRatio', () => {
  it('is the share of the annular velocity that moves cuttings', () => {
    expect(round(transportRatio(300, 20), 3)).toBe(0.933);
  });

  it('is one when nothing slips', () => {
    expect(transportRatio(300, 0)).toBe(1);
  });

  it('never goes below zero, however slow the mud is going', () => {
    expect(transportRatio(10, 40)).toBe(0);
  });

  it('refuses a stopped annulus', () => {
    expect(() => transportRatio(0, 20)).toThrow(/above zero/);
  });
});

describe('cuttingsConcentration', () => {
  it('reads a normal drilling rate as well under a percent', () => {
    const concentration = cuttingsConcentration({
      penetrationFeetPerHour: 60,
      bitDiameterInches: 8.5,
      flowGpm: 600,
      transportRatio: 0.935,
    });
    expect(round(concentration, 2)).toBe(0.53);
  });

  it('climbs as the transport ratio falls', () => {
    const good = cuttingsConcentration({
      penetrationFeetPerHour: 60,
      bitDiameterInches: 8.5,
      flowGpm: 600,
      transportRatio: 0.9,
    });
    const poor = cuttingsConcentration({
      penetrationFeetPerHour: 60,
      bitDiameterInches: 8.5,
      flowGpm: 600,
      transportRatio: 0.3,
    });
    expect(poor).toBeGreaterThan(good * 2.5);
  });

  it('is nothing off bottom', () => {
    expect(
      cuttingsConcentration({
        penetrationFeetPerHour: 0,
        bitDiameterInches: 8.5,
        flowGpm: 600,
        transportRatio: 0.9,
      })
    ).toBe(0);
  });
});

describe('holeCleaning', () => {
  it('says the hole is clean on a fast annulus', () => {
    const cleaning = holeCleaning({
      model,
      annularVelocityFeetPerMinute: 311.1,
      holeIdInches: 8.5,
      pipeOdInches: 5,
      mudWeightPpg: 12.4,
      penetrationFeetPerHour: 60,
      bitDiameterInches: 8.5,
      flowGpm: 600,
    });
    expect(cleaning.transportRatio).toBe(0.935);
    expect(cleaning.cleaning).toBe(true);
    expect(cleaning.cuttingsConcentrationPercent).toBe(0.53);
  });

  it('says it is not on a big hole at a slow rate with large cuttings', () => {
    const cleaning = holeCleaning({
      model,
      annularVelocityFeetPerMinute: 45,
      holeIdInches: 12.25,
      pipeOdInches: 5,
      mudWeightPpg: 9.2,
      cuttingDiameterInches: 0.5,
    });
    expect(cleaning.cleaning).toBe(false);
    expect(cleaning.transportRatio).toBeLessThan(0.5);
  });

  it('leaves the concentration out when nothing is being drilled', () => {
    const cleaning = holeCleaning({
      model,
      annularVelocityFeetPerMinute: 311.1,
      holeIdInches: 8.5,
      pipeOdInches: 5,
      mudWeightPpg: 12.4,
    });
    expect(cleaning.cuttingsConcentrationPercent).toBe(null);
  });
});
