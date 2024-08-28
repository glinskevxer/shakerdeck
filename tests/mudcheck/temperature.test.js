import { describe, it, expect } from 'vitest';
import {
  TYPICAL_GRADIENT,
  bottomHoleTemperature,
  fitTemperature,
  viscosityAt,
  correctToDepth,
  pressureError,
  temperatureSummary,
} from '../../src/mudcheck/temperature.js';

const readings = { coldF: 120, coldViscosity: 42, hotF: 200, hotViscosity: 24 };

describe('bottomHoleTemperature', () => {
  it('uses a typical basin gradient', () => {
    expect(TYPICAL_GRADIENT).toBe(1.2);
    expect(bottomHoleTemperature({ surfaceF: 80, tvdFeet: 10000 })).toBe(200);
  });

  it('takes a hotter basin', () => {
    expect(bottomHoleTemperature({ surfaceF: 80, tvdFeet: 10000, gradientPer100Feet: 1.8 })).toBe(
      260
    );
  });

  it('refuses a hole with no depth', () => {
    expect(() => bottomHoleTemperature({ surfaceF: 80, tvdFeet: 0 })).toThrow(/above zero/);
  });
});

describe('fitTemperature', () => {
  const fit = fitTemperature(readings);

  it('passes through both readings', () => {
    expect(viscosityAt(fit, 120)).toBeCloseTo(42, 6);
    expect(viscosityAt(fit, 200)).toBeCloseTo(24, 6);
  });

  it('falls with temperature all the way', () => {
    let previous = viscosityAt(fit, 100);
    for (let f = 120; f <= 320; f += 20) {
      const next = viscosityAt(fit, f);
      expect(next).toBeLessThan(previous);
      previous = next;
    }
  });

  it('refuses two readings at the same temperature', () => {
    expect(() => fitTemperature({ ...readings, hotF: 120 })).toThrow(/same temperature/);
  });

  it('refuses a viscosity of nothing', () => {
    expect(() => fitTemperature({ ...readings, hotViscosity: 0 })).toThrow(/above zero/);
  });
});

describe('correctToDepth', () => {
  const corrected = correctToDepth({
    fit: fitTemperature(readings),
    surfaceF: 120,
    tvdFeet: 12000,
  });

  it('works the bottom hole temperature out', () => {
    expect(corrected.bottomHoleF).toBe(264);
  });

  it('thins the mud on the way down', () => {
    expect(corrected.bottomHoleViscosity).toBeLessThan(corrected.surfaceViscosity);
    expect(corrected.thinningShare).toBeGreaterThan(0.3);
  });

  it('leaves a shallow hole nearly alone', () => {
    const shallow = correctToDepth({
      fit: fitTemperature(readings),
      surfaceF: 120,
      tvdFeet: 1000,
    });
    expect(shallow.thinningShare).toBeLessThan(0.1);
  });
});

describe('pressureError', () => {
  it('is smaller than the thinning, because the loss is not linear in viscosity', () => {
    const error = pressureError({ thinningShare: 0.4, flowIndex: 0.6 });
    expect(error.overstatedShare).toBeGreaterThan(0);
    expect(error.overstatedShare).toBeLessThan(0.4);
  });

  it('is nothing at all for a fluid that does not shear thin', () => {
    expect(pressureError({ thinningShare: 0.4, flowIndex: 1 }).overstatedShare).toBe(0);
  });

  it('is nothing when the mud does not thin', () => {
    expect(pressureError({ thinningShare: 0, flowIndex: 0.6 }).overstatedShare).toBe(0);
  });

  it('refuses a mud that thins away to nothing', () => {
    expect(() => pressureError({ thinningShare: 1, flowIndex: 0.6 })).toThrow(/away to nothing/);
  });
});

describe('temperatureSummary', () => {
  it('is the temperature block of the report', () => {
    const summary = temperatureSummary({ ...readings, tvdFeet: 12000 });
    expect(summary.bottomHoleF).toBe(264);
    expect(summary.thinningShare).toBeGreaterThan(0);
    expect(summary.lossRatio).toBeUndefined();
  });

  it('adds the pressure error when the flow index is known', () => {
    const summary = temperatureSummary({ ...readings, tvdFeet: 12000, flowIndex: 0.6 });
    expect(summary.lossRatio).toBeGreaterThan(0);
    expect(summary.overstatedShare).toBeGreaterThan(0);
  });
});
