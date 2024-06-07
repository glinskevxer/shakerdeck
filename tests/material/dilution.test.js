import { describe, it, expect } from 'vitest';
import {
  solidsPerFoot,
  solidsGenerated,
  dilutionToTarget,
  dilutionHoldingVolume,
  dilutionToHold,
  dilutionCost,
  dilutionAgainstRemoval,
} from '../../src/material/dilution.js';
import { round } from '../../src/util/number.js';

describe('solidsPerFoot', () => {
  it('is the hole capacity', () => {
    expect(round(solidsPerFoot(8.5), 5)).toBe(0.07019);
  });

  it('goes with the square of the bit', () => {
    expect(solidsPerFoot(12.25) / solidsPerFoot(6.125)).toBeCloseTo(4, 10);
  });

  it('refuses a bit with no diameter', () => {
    expect(() => solidsPerFoot(0)).toThrow(/above zero/);
  });
});

describe('solidsGenerated', () => {
  it('counts the solids over a section', () => {
    const made = solidsGenerated({ bitDiameterInches: 8.5, footageFeet: 1000 });
    expect(round(made.barrels, 1)).toBe(70.2);
  });

  it('adds the washout', () => {
    const gauge = solidsGenerated({ bitDiameterInches: 8.5, footageFeet: 1000 });
    const washed = solidsGenerated({
      bitDiameterInches: 8.5,
      footageFeet: 1000,
      washoutFraction: 0.1,
    });
    expect(washed.barrels).toBeCloseTo(gauge.barrels * 1.1, 1);
    expect(washed.barrels).toBe(77.21);
  });

  it('weighs them at the gravity of shale', () => {
    expect(
      solidsGenerated({ bitDiameterInches: 8.5, footageFeet: 1000, washoutFraction: 0.1 }).pounds
    ).toBe(70257);
  });

  it('is nothing over no footage', () => {
    expect(solidsGenerated({ bitDiameterInches: 8.5, footageFeet: 0 }).barrels).toBe(0);
  });
});

describe('dilutionToTarget', () => {
  it('works out the water for a point off the solids', () => {
    expect(dilutionToTarget({ fromFraction: 0.06, toFraction: 0.05, volumeBbl: 800 })).toEqual({
      addedBbl: 160,
      finalVolumeBbl: 960,
    });
  });

  it('lands on the fraction it was asked for', () => {
    const job = dilutionToTarget({ fromFraction: 0.06, toFraction: 0.05, volumeBbl: 800 });
    expect((800 * 0.06) / job.finalVolumeBbl).toBeCloseTo(0.05, 6);
  });

  it('runs away as the target gets tight', () => {
    const easy = dilutionToTarget({ fromFraction: 0.06, toFraction: 0.05, volumeBbl: 800 });
    const hard = dilutionToTarget({ fromFraction: 0.06, toFraction: 0.02, volumeBbl: 800 });
    expect(hard.addedBbl).toBeGreaterThanOrEqual(easy.addedBbl * 10);
  });

  it('refuses a target above where the mud is', () => {
    expect(() =>
      dilutionToTarget({ fromFraction: 0.05, toFraction: 0.06, volumeBbl: 800 })
    ).toThrow(/not below/);
  });
});

describe('dilutionHoldingVolume', () => {
  it('dumps and replaces the same volume', () => {
    const job = dilutionHoldingVolume({ fromFraction: 0.06, toFraction: 0.05, volumeBbl: 800 });
    expect(job.discardBbl).toBe(job.addedBbl);
    expect(job.finalVolumeBbl).toBe(800);
  });

  it('needs less water than letting the volume grow', () => {
    const held = dilutionHoldingVolume({ fromFraction: 0.06, toFraction: 0.05, volumeBbl: 800 });
    const grown = dilutionToTarget({ fromFraction: 0.06, toFraction: 0.05, volumeBbl: 800 });
    expect(held.addedBbl).toBeLessThan(grown.addedBbl);
  });

  it('refuses a target above where the mud is', () => {
    expect(() =>
      dilutionHoldingVolume({ fromFraction: 0.05, toFraction: 0.05, volumeBbl: 800 })
    ).toThrow(/not below/);
  });
});

describe('dilutionToHold', () => {
  it('matches the solids arriving', () => {
    const job = dilutionToHold({ targetFraction: 0.05, solidsBbl: 77.2 });
    expect(job.dilutionBbl).toBe(1466.8);
  });

  it('falls with what the equipment takes out', () => {
    const bare = dilutionToHold({ targetFraction: 0.05, solidsBbl: 77.2 });
    const helped = dilutionToHold({
      targetFraction: 0.05,
      solidsBbl: 77.2,
      removalEfficiency: 0.6,
    });
    expect(helped.dilutionBbl).toBeCloseTo(bare.dilutionBbl * 0.4, 0);
  });

  it('needs none at all when everything is removed', () => {
    expect(
      dilutionToHold({ targetFraction: 0.05, solidsBbl: 77.2, removalEfficiency: 1 }).dilutionBbl
    ).toBe(0);
  });

  it('is nothing when nothing is being drilled', () => {
    expect(dilutionToHold({ targetFraction: 0.05, solidsBbl: 0 }).dilutionBbl).toBe(0);
  });
});

describe('dilutionCost', () => {
  it('counts the water, the mud thrown away and the treatment', () => {
    expect(
      dilutionCost({
        dilutionBbl: 586,
        discardBbl: 133,
        waterCostPerBbl: 1.5,
        mudCostPerBbl: 38,
        bariteCostPerBbl: 12,
      })
    ).toEqual({
      waterCost: 879,
      discardedMudCost: 5054,
      retreatmentCost: 7032,
      totalCost: 12965,
    });
  });

  it('is dominated by the mud, not the water', () => {
    const cost = dilutionCost({
      dilutionBbl: 586,
      discardBbl: 133,
      waterCostPerBbl: 1.5,
      mudCostPerBbl: 38,
      bariteCostPerBbl: 12,
    });
    expect(cost.waterCost).toBeLessThan(cost.totalCost * 0.1);
  });
});

describe('dilutionAgainstRemoval', () => {
  const comparison = dilutionAgainstRemoval({
    solidsBbl: 77.2,
    targetFraction: 0.05,
    removalEfficiency: 0.6,
    mudCostPerBbl: 38,
    removalCostPerBbl: 65,
  });

  it('shows removal winning over a hole section', () => {
    expect(comparison.savedCost).toBeGreaterThan(0);
    expect(comparison.withRemovalCost).toBeLessThan(comparison.dilutionOnlyCost);
  });

  it('reports both dilution volumes', () => {
    expect(comparison.dilutionOnlyBbl).toBe(1466.8);
    expect(comparison.withRemovalBbl).toBe(586.7);
  });

  it('counts what the equipment took out', () => {
    expect(comparison.removedBbl).toBe(46.32);
  });

  it('stops winning when the equipment is dear enough', () => {
    const dear = dilutionAgainstRemoval({
      solidsBbl: 77.2,
      targetFraction: 0.05,
      removalEfficiency: 0.6,
      mudCostPerBbl: 38,
      removalCostPerBbl: 900,
    });
    expect(dear.savedCost).toBeLessThan(0);
  });
});
