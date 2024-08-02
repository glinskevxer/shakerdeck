import { describe, it, expect } from 'vitest';
import {
  INDIVIDUALS_CONSTANT,
  RANGE_CONSTANT,
  movingRanges,
  controlLimits,
  outOfControl,
  runsOnOneSide,
  trends,
  chart,
} from '../../src/quality/control.js';

const steady = [22, 23, 22, 21, 22, 23, 22, 21, 23, 22];

describe('movingRanges', () => {
  it('is the gap between consecutive readings', () => {
    expect(movingRanges([10, 12, 9])).toEqual([2, 3]);
  });

  it('is never negative', () => {
    expect(movingRanges([9, 12]).every((range) => range >= 0)).toBe(true);
  });

  it('refuses a single reading', () => {
    expect(() => movingRanges([10])).toThrow(/at least two readings/);
    expect(() => movingRanges(null)).toThrow(/at least two readings/);
  });
});

describe('controlLimits', () => {
  it('uses the standard constants', () => {
    expect(INDIVIDUALS_CONSTANT).toBe(2.66);
    expect(RANGE_CONSTANT).toBe(3.267);
  });

  it('centres on the mean', () => {
    expect(controlLimits(steady).centre).toBe(22.1);
  });

  it('puts the limits either side of the centre', () => {
    const limits = controlLimits(steady);
    expect(limits.upper).toBeGreaterThan(limits.centre);
    expect(limits.lower).toBeLessThan(limits.centre);
  });

  it('widens the limits on a noisier property', () => {
    const noisy = [22, 30, 14, 28, 16, 26, 18, 24];
    expect(controlLimits(noisy).upper - controlLimits(noisy).lower).toBeGreaterThan(
      controlLimits(steady).upper - controlLimits(steady).lower
    );
  });
});

describe('outOfControl', () => {
  it('finds nothing on a steady property', () => {
    expect(outOfControl(steady)).toEqual([]);
  });

  it('finds a point above the upper limit', () => {
    const spiked = [...steady, 40];
    const rows = outOfControl(spiked);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ value: 40, rule: 'above the upper limit' });
  });

  it('finds a point below the lower limit', () => {
    const dipped = [...steady, 5];
    expect(outOfControl(dipped)[0].rule).toBe('below the lower limit');
  });

  it('takes limits worked out beforehand', () => {
    const limits = controlLimits(steady);
    expect(outOfControl([30], limits)).toHaveLength(1);
  });
});

describe('runsOnOneSide', () => {
  it('finds nothing when the readings alternate', () => {
    expect(runsOnOneSide(steady)).toEqual([]);
  });

  it('catches a mud drifting while every reading is still inside', () => {
    const drifting = [20, 21, 20, 21, 20, 21, 20, 21, 26, 27, 26, 27, 26, 27, 26, 27];
    const runs = runsOnOneSide(drifting);
    expect(runs).toHaveLength(2);
    expect(runs[0].side).toBe('below');
    expect(runs[1].side).toBe('above');
  });

  it('takes a shorter run when asked', () => {
    expect(runsOnOneSide([1, 1, 1, 5, 5, 5], null, 3).length).toBeGreaterThan(0);
  });
});

describe('trends', () => {
  it('finds nothing on a flat property', () => {
    expect(trends(steady)).toEqual([]);
  });

  it('finds a steady climb', () => {
    const rows = trends([20, 21, 22, 23, 24, 25, 26]);
    expect(rows[0]).toMatchObject({ direction: 'climbing', from: 0, to: 5 });
  });

  it('finds a steady fall', () => {
    expect(trends([26, 25, 24, 23, 22, 21]).length).toBe(1);
    expect(trends([26, 25, 24, 23, 22, 21])[0].direction).toBe('falling');
  });

  it('is broken by a repeated reading', () => {
    expect(trends([20, 21, 22, 22, 23, 24, 25])).toEqual([]);
  });

  it('takes a shorter run when asked', () => {
    expect(trends([20, 21, 22], 3)).toHaveLength(1);
  });
});

describe('chart', () => {
  it('is in control on a steady property', () => {
    const result = chart('plasticViscosity', steady);
    expect(result.inControl).toBe(true);
    expect(result.property).toBe('plasticViscosity');
  });

  it('is out of control on a drifting one', () => {
    const result = chart(
      'plasticViscosity',
      [20, 21, 20, 21, 20, 21, 20, 21, 26, 27, 26, 27, 26, 27, 26, 27]
    );
    expect(result.inControl).toBe(false);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('carries the limits for plotting', () => {
    const result = chart('weightPpg', [12.4, 12.5, 12.4, 12.3, 12.4]);
    expect(result.upper).toBeGreaterThan(result.centre);
    expect(result.rangeUpper).toBeGreaterThan(0);
  });
});
