import { describe, it, expect } from 'vitest';
import {
  STEEL_PPG,
  buoyancyFactor,
  hookload,
  hookloadChange,
  neutralPoint,
  collarsEnough,
} from '../../src/well/buoyancy.js';

describe('buoyancyFactor', () => {
  it('uses the weight of steel', () => {
    expect(STEEL_PPG).toBe(65.5);
  });

  it('is one in air and falls with the mud', () => {
    expect(buoyancyFactor(0.001)).toBeCloseTo(1, 4);
    expect(buoyancyFactor(12.4)).toBe(0.8107);
    expect(buoyancyFactor(16)).toBeLessThan(buoyancyFactor(12.4));
  });

  it('refuses a mud that would float steel', () => {
    expect(() => buoyancyFactor(70)).toThrow(/would float steel/);
    expect(() => buoyancyFactor(65.5)).toThrow(/would float steel/);
  });
});

describe('hookload', () => {
  const load = hookload({ airWeightPounds: 300000, mudPpg: 12.4, blockWeightPounds: 45000 });

  it('takes the buoyancy off the weight in air', () => {
    expect(load.buoyedWeightPounds).toBe(243210);
    expect(load.lostToBuoyancyPounds).toBe(56790);
  });

  it('adds the blocks on top', () => {
    expect(load.hookloadPounds).toBe(load.buoyedWeightPounds + 45000);
  });

  it('reads nothing for a string of nothing', () => {
    expect(hookload({ airWeightPounds: 0, mudPpg: 12.4 }).hookloadPounds).toBe(0);
  });

  it('carries the factor it worked with', () => {
    expect(load.buoyancyFactor).toBe(buoyancyFactor(12.4));
  });
});

describe('hookloadChange', () => {
  it('shows a weight up taking hookload off', () => {
    const change = hookloadChange({ airWeightPounds: 300000, fromPpg: 12.4, toPpg: 16 });
    expect(change.changePounds).toBeLessThan(0);
    expect(Math.abs(change.changePounds)).toBeGreaterThan(10000);
  });

  it('shows a cut back putting it back on', () => {
    expect(
      hookloadChange({ airWeightPounds: 300000, fromPpg: 16, toPpg: 12.4 }).changePounds
    ).toBeGreaterThan(0);
  });

  it('is nothing when the weight does not move', () => {
    expect(
      hookloadChange({ airWeightPounds: 300000, fromPpg: 12.4, toPpg: 12.4 }).changePounds
    ).toBe(0);
  });
});

describe('neutralPoint', () => {
  it('is higher up the string for more weight on bit', () => {
    expect(neutralPoint({ weightOnBitPounds: 40000, collarWeightPerFoot: 100, mudPpg: 12.4 })).toBe(
      493
    );
    expect(
      neutralPoint({ weightOnBitPounds: 60000, collarWeightPerFoot: 100, mudPpg: 12.4 })
    ).toBeGreaterThan(
      neutralPoint({ weightOnBitPounds: 40000, collarWeightPerFoot: 100, mudPpg: 12.4 })
    );
  });

  it('moves up as the mud gets heavier, because the collars weigh less', () => {
    expect(
      neutralPoint({ weightOnBitPounds: 40000, collarWeightPerFoot: 100, mudPpg: 16 })
    ).toBeGreaterThan(
      neutralPoint({ weightOnBitPounds: 40000, collarWeightPerFoot: 100, mudPpg: 12.4 })
    );
  });

  it('is at the bit with no weight on it', () => {
    expect(neutralPoint({ weightOnBitPounds: 0, collarWeightPerFoot: 100, mudPpg: 12.4 })).toBe(0);
  });
});

describe('collarsEnough', () => {
  it('passes a string with enough collar under the neutral point', () => {
    const check = collarsEnough({
      weightOnBitPounds: 40000,
      collarLengthFeet: 600,
      collarWeightPerFoot: 100,
      mudPpg: 12.4,
    });
    expect(check.enough).toBe(true);
    expect(check.shortByFeet).toBe(0);
  });

  it('fails one without', () => {
    const check = collarsEnough({
      weightOnBitPounds: 60000,
      collarLengthFeet: 600,
      collarWeightPerFoot: 100,
      mudPpg: 12.4,
    });
    expect(check.enough).toBe(false);
    expect(check.shortByFeet).toBeGreaterThan(0);
  });

  it('fails a string that was fine before the weight up', () => {
    const before = collarsEnough({
      weightOnBitPounds: 42000,
      collarLengthFeet: 600,
      collarWeightPerFoot: 100,
      mudPpg: 10,
    });
    const after = collarsEnough({
      weightOnBitPounds: 42000,
      collarLengthFeet: 600,
      collarWeightPerFoot: 100,
      mudPpg: 16,
    });
    expect(before.enough).toBe(true);
    expect(after.enough).toBe(false);
  });

  it('takes a different design factor', () => {
    const tight = collarsEnough({
      weightOnBitPounds: 40000,
      collarLengthFeet: 600,
      collarWeightPerFoot: 100,
      mudPpg: 12.4,
      designFactor: 1.5,
    });
    expect(tight.withDesignFactorFeet).toBeGreaterThan(tight.neutralPointFeet);
  });
});
