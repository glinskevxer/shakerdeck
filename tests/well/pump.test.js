import { describe, it, expect } from 'vitest';
import {
  TRIPLEX_CONSTANT,
  DUPLEX_CONSTANT,
  triplexOutput,
  duplexOutput,
  pumpOutput,
  flowRateGpm,
  flowRateBpm,
  strokesFor,
  minutesFor,
  circulationTimes,
  lagStrokes,
  pressureAtNewRate,
  describePump,
} from '../../src/well/pump.js';
import { round } from '../../src/util/number.js';

describe('triplexOutput', () => {
  it('uses the three cylinder constant', () => {
    expect(TRIPLEX_CONSTANT).toBe(0.000243);
    expect(DUPLEX_CONSTANT).toBe(0.000162);
  });

  it('reads a six and a half by twelve pump at full efficiency', () => {
    expect(round(triplexOutput(6.5, 12), 4)).toBe(0.1232);
  });

  it('drops with volumetric efficiency', () => {
    expect(round(triplexOutput(6.5, 12, 0.95), 4)).toBe(0.117);
    expect(triplexOutput(6.5, 12, 0.9)).toBeLessThan(triplexOutput(6.5, 12));
  });

  it('goes with the square of the liner', () => {
    expect(triplexOutput(12, 10) / triplexOutput(6, 10)).toBeCloseTo(4, 10);
  });

  it('refuses an efficiency quoted as a percentage', () => {
    expect(() => triplexOutput(6.5, 12, 95)).toThrow(/above one/);
  });

  it('refuses a missing liner or stroke', () => {
    expect(() => triplexOutput(0, 12)).toThrow(/above zero/);
    expect(() => triplexOutput(6.5, 0)).toThrow(/above zero/);
  });
});

describe('duplexOutput', () => {
  it('reads a double acting pump', () => {
    expect(round(duplexOutput(6, 2.5, 14), 4)).toBe(0.1491);
  });

  it('loses output to a fatter rod', () => {
    expect(duplexOutput(6, 3, 14)).toBeLessThan(duplexOutput(6, 2.5, 14));
  });

  it('refuses a rod that does not fit the liner', () => {
    expect(() => duplexOutput(6, 6, 14)).toThrow(/does not fit/);
  });
});

describe('pumpOutput', () => {
  it('dispatches on the type on the tour sheet', () => {
    expect(pumpOutput({ type: 'triplex', linerInches: 6.5, strokeInches: 12 })).toBeCloseTo(
      triplexOutput(6.5, 12),
      12
    );
    expect(
      pumpOutput({ type: 'DUPLEX', linerInches: 6, rodInches: 2.5, strokeInches: 14 })
    ).toBeCloseTo(duplexOutput(6, 2.5, 14), 12);
  });

  it('assumes a triplex, which is what is on the rig', () => {
    expect(pumpOutput({ linerInches: 6.5, strokeInches: 12 })).toBeCloseTo(
      triplexOutput(6.5, 12),
      12
    );
  });

  it('refuses a pump it does not know', () => {
    expect(() => pumpOutput({ type: 'quintuplex', linerInches: 5, strokeInches: 10 })).toThrow(
      /unknown pump type/
    );
  });
});

describe('flow rate', () => {
  it('converts output and stroke rate to gallons and barrels a minute', () => {
    expect(round(flowRateGpm(0.117, 120), 1)).toBe(589.7);
    expect(round(flowRateBpm(0.117, 120), 2)).toBe(14.04);
  });

  it('is zero when the pump is off', () => {
    expect(flowRateGpm(0.117, 0)).toBe(0);
  });
});

describe('strokesFor and minutesFor', () => {
  it('counts the strokes to move a volume', () => {
    expect(round(strokesFor(230.72, 0.11704095), 0)).toBe(1971);
  });

  it('counts the minutes at a stroke rate', () => {
    expect(round(minutesFor(230.72, 0.11704095, 120), 1)).toBe(16.4);
  });

  it('refuses a dead pump', () => {
    expect(() => strokesFor(100, 0)).toThrow(/above zero/);
    expect(() => minutesFor(100, 0.117, 0)).toThrow(/pump rate is zero/);
  });
});

describe('circulationTimes', () => {
  const times = circulationTimes({
    stringBbl: 230.72,
    annulusBbl: 480,
    bblPerStroke: 0.11704095,
    strokesPerMinute: 120,
  });

  it('counts down to the bit', () => {
    expect(times.surfaceToBitStrokes).toBe(1971);
    expect(times.surfaceToBitMinutes).toBe(16.4);
  });

  it('counts bottoms up', () => {
    expect(times.bottomsUpStrokes).toBe(4101);
    expect(times.bottomsUpMinutes).toBe(34.2);
  });

  it('counts a full circulation as the sum of the two', () => {
    expect(times.fullCirculationStrokes).toBe(6072);
    expect(times.fullCirculationMinutes).toBe(50.6);
    expect(times.totalSystemBbl).toBe(710.7);
  });

  it('refuses a stopped pump', () => {
    expect(() =>
      circulationTimes({
        stringBbl: 100,
        annulusBbl: 100,
        bblPerStroke: 0.117,
        strokesPerMinute: 0,
      })
    ).toThrow(/above zero/);
  });
});

describe('lagStrokes', () => {
  it('is the annulus in strokes', () => {
    expect(round(lagStrokes(480, 0.11704095), 0)).toBe(4101);
  });
});

describe('pressureAtNewRate', () => {
  it('falls with the square of the rate', () => {
    expect(round(pressureAtNewRate(2400, 120, 100), 1)).toBe(1666.7);
    expect(pressureAtNewRate(2400, 120, 240)).toBeCloseTo(9600, 6);
  });

  it('is zero with the pump off', () => {
    expect(pressureAtNewRate(2400, 120, 0)).toBe(0);
  });

  it('refuses a zero starting rate', () => {
    expect(() => pressureAtNewRate(2400, 0, 100)).toThrow(/above zero/);
  });
});

describe('describePump', () => {
  it('reports the pump the way the daily report prints it', () => {
    expect(
      describePump(
        {
          label: 'number one',
          type: 'triplex',
          linerInches: 6.5,
          strokeInches: 12,
          efficiency: 0.95,
        },
        120
      )
    ).toEqual({
      label: 'number one',
      bblPerStroke: 0.117,
      strokesPerMinute: 120,
      gpm: 589.9,
      bpm: 14.04,
    });
  });

  it('falls back to the type when there is no label', () => {
    expect(describePump({ type: 'triplex', linerInches: 6, strokeInches: 14 }, 90).label).toBe(
      'triplex'
    );
  });
});
