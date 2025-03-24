import { describe, it, expect } from 'vitest';
import { hydrostatic, equivalentWeight } from '../../src/units/density.js';
import { annularCapacity, boreCapacity } from '../../src/well/capacity.js';
import { annularVelocity, pipeVelocity } from '../../src/hydraulics/velocity.js';
import { annularLoss, pipeLoss } from '../../src/hydraulics/pressure-loss.js';
import { bitPressureDrop, totalFlowArea } from '../../src/hydraulics/bit.js';
import { equivalentCirculatingDensity } from '../../src/hydraulics/ecd.js';
import { triplexOutput, circulationTimes } from '../../src/well/pump.js';
import { weightUp } from '../../src/material/weightup.js';
import { soliditySplit } from '../../src/solids/analysis.js';
import { holeCleaning } from '../../src/hydraulics/cuttings.js';

const model = { n: 0.6077, k: 1.014 };
const annular = { n: 0.4352, k: 2.6258 };

describe('a very deep well', () => {
  it('works a hydrostatic at thirty thousand feet', () => {
    expect(hydrostatic(18, 30000)).toBeCloseTo(28080, 0);
  });

  it('inverts it', () => {
    expect(equivalentWeight(28080, 30000)).toBeCloseTo(18, 6);
  });

  it('makes the annular friction almost nothing in equivalent weight', () => {
    const deep = equivalentCirculatingDensity({
      weightPpg: 18,
      annularLossPsi: 400,
      tvdFeet: 30000,
    });
    expect(deep - 18).toBeLessThan(0.3);
  });
});

describe('a very shallow well', () => {
  it('makes the same annular friction enormous in equivalent weight', () => {
    const shallow = equivalentCirculatingDensity({
      weightPpg: 9,
      annularLossPsi: 400,
      tvdFeet: 500,
    });
    expect(shallow - 9).toBeGreaterThan(10);
  });

  it('still works a hydrostatic at a single foot', () => {
    expect(hydrostatic(9, 1)).toBeCloseTo(0.468, 6);
  });
});

describe('a very big hole', () => {
  it('reads a twenty six inch hole', () => {
    expect(boreCapacity(26)).toBeGreaterThan(0.65);
  });

  it('makes the annular velocity crawl at a normal rate', () => {
    expect(annularVelocity(600, 26, 5)).toBeLessThan(25);
  });

  it('reads a transport ratio the field would not believe', () => {
    // The annular apparent viscosity runs away at these shear rates, so the
    // slip velocity comes out tiny and the transport ratio looks fine. It is
    // not: a twenty six inch hole at twenty feet a minute does not clean, and
    // this is the case where the correlation is outside where it was fitted.
    // The velocity itself is the number to read here.
    const velocity = annularVelocity(600, 26, 5);
    const cleaning = holeCleaning({
      model: annular,
      annularVelocityFeetPerMinute: velocity,
      holeIdInches: 26,
      pipeOdInches: 5,
      mudWeightPpg: 9.2,
      cuttingDiameterInches: 0.25,
    });
    expect(cleaning.transportRatio).toBeGreaterThan(0.5);
    expect(velocity).toBeLessThan(100);
  });
});

describe('a very tight annulus', () => {
  it('reads a liner run with almost no clearance', () => {
    expect(annularCapacity(8.5, 8.4)).toBeLessThan(0.002);
  });

  it('makes the velocity enormous at a normal rate', () => {
    expect(annularVelocity(600, 8.5, 8.4)).toBeGreaterThan(8000);
  });

  it('makes the pressure loss enormous with it', () => {
    const loss = annularLoss({
      flowGpm: 600,
      holeIdInches: 8.5,
      pipeOdInches: 8.4,
      lengthFeet: 1000,
      densityPpg: 12.4,
      model: annular,
    });
    expect(loss.psi).toBeGreaterThan(5000);
  });
});

describe('a pump barely turning', () => {
  it('works a stroke a minute out', () => {
    const times = circulationTimes({
      stringBbl: 200,
      annulusBbl: 400,
      bblPerStroke: triplexOutput(6.5, 12),
      strokesPerMinute: 1,
    });
    expect(times.fullCirculationMinutes).toBeGreaterThan(4000);
  });

  it('loses almost no pressure at a trickle', () => {
    const loss = pipeLoss({
      flowGpm: 5,
      idInches: 4.276,
      lengthFeet: 9400,
      densityPpg: 12.4,
      model,
    });
    expect(loss.psi).toBeLessThan(20);
    expect(loss.regime).toBe('laminar');
  });
});

describe('a pump flat out', () => {
  it('reads a velocity that would wash the hole out', () => {
    expect(pipeVelocity(1600, 4.276)).toBeGreaterThan(2000);
  });

  it('blows the bit pressure past anything a pump could deliver', () => {
    const drop = bitPressureDrop({
      flowGpm: 1600,
      totalFlowAreaSquareInches: totalFlowArea([9, 9, 9]),
      densityPpg: 12.4,
    });
    expect(drop).toBeGreaterThan(20000);
  });
});

describe('the heaviest and lightest muds', () => {
  it('weights a mud up to nearly the gravity of barite', () => {
    const order = weightUp({ fromPpg: 12, toPpg: 34, volumeBbl: 100 });
    expect(order.volumeIncreaseBbl).toBeGreaterThan(100);
  });

  it('refuses to go past the agent itself', () => {
    expect(() => weightUp({ fromPpg: 12, toPpg: 36, volumeBbl: 100 })).toThrow(/cannot make/);
  });

  it('splits the solids on a mud that is almost all barite', () => {
    const split = soliditySplit({ weightPpg: 20, solidsPercent: 45, waterPercent: 55 });
    expect(split.highGravityPercent).toBeGreaterThan(split.lowGravityPercent);
  });

  it('splits them on a mud that is almost all water', () => {
    const split = soliditySplit({ weightPpg: 8.6, solidsPercent: 1.5, waterPercent: 98.5 });
    expect(split.lowGravityPercent).toBeGreaterThan(0);
  });
});
