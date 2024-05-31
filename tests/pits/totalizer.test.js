import { describe, it, expect } from 'vitest';
import {
  activeVolume,
  pitChange,
  tripFill,
  tripCheck,
  pitTrend,
} from '../../src/pits/totalizer.js';
import { tankVolume } from '../../src/pits/geometry.js';

const tanks = [
  { name: 'pit 1', shape: 'rectangular', lengthFeet: 20, widthFeet: 10 },
  { name: 'pit 2', shape: 'rectangular', lengthFeet: 20, widthFeet: 10 },
  { name: 'reserve', shape: 'rectangular', lengthFeet: 30, widthFeet: 12, active: false },
];

const levels = { 'pit 1': 6, 'pit 2': 5, reserve: 8 };

describe('activeVolume', () => {
  it('totals only the tanks that are lined up', () => {
    const total = activeVolume(tanks, levels);
    const expected = tankVolume(tanks[0], 6) + tankVolume(tanks[1], 5);
    expect(total.activeBbl).toBeCloseTo(expected, 1);
  });

  it('still reports the tanks that are not lined up', () => {
    const total = activeVolume(tanks, levels);
    expect(total.tanks).toHaveLength(3);
    expect(total.tanks[2]).toMatchObject({ name: 'reserve', active: false });
  });

  it('leaves a transfer into the reserve out of the total', () => {
    const before = activeVolume(tanks, levels).activeBbl;
    const after = activeVolume(tanks, { ...levels, reserve: 10 }).activeBbl;
    expect(after).toBe(before);
  });

  it('says which tank has no reading', () => {
    expect(() => activeVolume(tanks, { 'pit 1': 6 })).toThrow(/no level reading for pit 2/);
  });
});

describe('pitChange', () => {
  it('is steady inside the threshold', () => {
    const change = pitChange({ beforeBbl: 400, afterBbl: 405 });
    expect(change.verdict).toBe('steady');
    expect(change.changeBbl).toBe(5);
    expect(change.overThreshold).toBe(false);
  });

  it('calls a gain', () => {
    expect(pitChange({ beforeBbl: 400, afterBbl: 415 }).verdict).toBe('gain');
  });

  it('calls a loss', () => {
    expect(pitChange({ beforeBbl: 400, afterBbl: 380 }).verdict).toBe('loss');
  });

  it('takes the threshold at its edge', () => {
    expect(pitChange({ beforeBbl: 400, afterBbl: 410 }).verdict).toBe('gain');
    expect(pitChange({ beforeBbl: 400, afterBbl: 390 }).verdict).toBe('loss');
  });

  it('takes a tighter threshold on a well that warrants one', () => {
    expect(pitChange({ beforeBbl: 400, afterBbl: 403, thresholdBbl: 2 }).verdict).toBe('gain');
  });
});

describe('tripFill', () => {
  it('takes the steel and the bore pulling wet', () => {
    expect(
      tripFill({ lengthFeet: 1000, displacementBblPerFoot: 0.00652, capacityBblPerFoot: 0.01776 })
    ).toBe(24.28);
  });

  it('takes only the steel pulling dry', () => {
    expect(
      tripFill({
        lengthFeet: 1000,
        displacementBblPerFoot: 0.00652,
        capacityBblPerFoot: 0.01776,
        wet: false,
      })
    ).toBe(6.52);
  });

  it('is nothing for no pipe', () => {
    expect(tripFill({ lengthFeet: 0, displacementBblPerFoot: 0.00652 })).toBe(0);
  });
});

describe('tripCheck', () => {
  it('is on paper inside the threshold', () => {
    const check = tripCheck({ expectedBbl: 24.28, actualBbl: 26 });
    expect(check.verdict).toBe('on paper');
    expect(check.investigate).toBe(false);
  });

  it('flags a hole that took less than it should have', () => {
    const check = tripCheck({ expectedBbl: 24.28, actualBbl: 18 });
    expect(check.verdict).toMatch(/took less/);
    expect(check.investigate).toBe(true);
    expect(check.differenceBbl).toBe(-6.28);
  });

  it('flags a hole that took more', () => {
    expect(tripCheck({ expectedBbl: 24.28, actualBbl: 31 }).verdict).toMatch(/took more/);
  });
});

describe('pitTrend', () => {
  const readings = [
    { time: '00:00', activeBbl: 620 },
    { time: '04:00', activeBbl: 616 },
    { time: '08:00', activeBbl: 604 },
    { time: '12:00', activeBbl: 602 },
  ];

  it('reports a step between each pair', () => {
    const trend = pitTrend(readings);
    expect(trend.steps).toHaveLength(3);
    expect(trend.steps[0]).toMatchObject({ from: '00:00', to: '04:00', verdict: 'steady' });
  });

  it('flags the step that crossed the threshold', () => {
    const trend = pitTrend(readings);
    expect(trend.flagged).toBe(1);
    expect(trend.steps[1].verdict).toBe('loss');
  });

  it('reports the net change over the tour', () => {
    expect(pitTrend(readings).netChangeBbl).toBe(-18);
  });

  it('refuses a single reading', () => {
    expect(() => pitTrend([readings[0]])).toThrow(/at least two readings/);
    expect(() => pitTrend(null)).toThrow(/at least two readings/);
  });
});
