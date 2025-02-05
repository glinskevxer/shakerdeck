import { describe, it, expect } from 'vitest';
import {
  GALLONS_PER_BARREL,
  CUBIC_FEET_PER_BARREL,
  LITRES_PER_BARREL,
  CUBIC_METRES_PER_BARREL,
  FEET_PER_METRE,
  POUNDS_PER_KILOGRAM,
  bblToGal,
  galToBbl,
  bblToCubicFeet,
  cubicFeetToBbl,
  bblToCubicMetres,
  cubicMetresToBbl,
  bblToLitres,
  litresToBbl,
  feetToMetres,
  metresToFeet,
  inchesToMillimetres,
  millimetresToInches,
  poundsToKilograms,
  kilogramsToPounds,
  fahrenheitToCelsius,
  celsiusToFahrenheit,
  fahrenheitToRankine,
  gpmToBpm,
  bpmToGpm,
  cylinderVolumeBbl,
  describeVolume,
} from '../../src/units/measure.js';
import { round } from '../../src/util/number.js';

describe('barrels and gallons', () => {
  it('holds forty two gallons', () => {
    expect(GALLONS_PER_BARREL).toBe(42);
    expect(bblToGal(1)).toBe(42);
    expect(galToBbl(84)).toBe(2);
  });

  it('carries the conversion constants a barrel is defined by', () => {
    expect(CUBIC_FEET_PER_BARREL).toBeCloseTo(5.614583, 6);
    expect(LITRES_PER_BARREL).toBeCloseTo(158.987295, 6);
    expect(CUBIC_METRES_PER_BARREL).toBeCloseTo(LITRES_PER_BARREL / 1000, 9);
    expect(FEET_PER_METRE).toBeCloseTo(3.280839895, 9);
    expect(POUNDS_PER_KILOGRAM).toBeCloseTo(2.20462262, 8);
  });

  it('converts a pit volume', () => {
    expect(round(bblToGal(315), 0)).toBe(13230);
  });
});

describe('barrels, cubic feet, cubic metres and litres', () => {
  it('converts a barrel', () => {
    expect(round(bblToCubicFeet(1), 4)).toBe(5.6146);
    expect(round(bblToCubicMetres(1), 6)).toBe(0.158987);
    expect(round(bblToLitres(1), 3)).toBe(158.987);
  });

  it('round trips each pair', () => {
    expect(cubicFeetToBbl(bblToCubicFeet(250))).toBeCloseTo(250, 9);
    expect(cubicMetresToBbl(bblToCubicMetres(250))).toBeCloseTo(250, 9);
    expect(litresToBbl(bblToLitres(250))).toBeCloseTo(250, 9);
  });

  it('handles a negative volume, which is a loss', () => {
    expect(round(bblToCubicMetres(-40), 3)).toBe(-6.359);
  });
});

describe('length and mass', () => {
  it('converts depth', () => {
    expect(round(feetToMetres(10000), 1)).toBe(3048);
    expect(round(metresToFeet(3048), 0)).toBe(10000);
  });

  it('converts a bit size', () => {
    expect(round(inchesToMillimetres(8.5), 1)).toBe(215.9);
    expect(round(millimetresToInches(311.15), 3)).toBe(12.25);
  });

  it('converts a sack weight', () => {
    expect(round(poundsToKilograms(100), 2)).toBe(45.36);
    expect(round(kilogramsToPounds(25), 2)).toBe(55.12);
  });
});

describe('temperature', () => {
  it('converts a flowline temperature', () => {
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100, 10);
    expect(celsiusToFahrenheit(100)).toBeCloseTo(212, 10);
    expect(round(fahrenheitToCelsius(150), 1)).toBe(65.6);
  });

  it('meets at forty below', () => {
    expect(fahrenheitToCelsius(-40)).toBeCloseTo(-40, 10);
  });

  it('converts to rankine for a gas law', () => {
    expect(fahrenheitToRankine(60)).toBeCloseTo(519.67, 6);
  });

  it('refuses a temperature below absolute zero', () => {
    expect(() => fahrenheitToRankine(-500)).toThrow(/absolute zero/);
  });
});

describe('flow rate', () => {
  it('converts pump rate both ways', () => {
    expect(round(gpmToBpm(420), 2)).toBe(10);
    expect(round(bpmToGpm(8.5), 0)).toBe(357);
  });
});

describe('cylinderVolumeBbl', () => {
  it('reads a round tank', () => {
    expect(round(cylinderVolumeBbl(120, 10), 1)).toBe(139.9);
  });

  it('reads a hole section', () => {
    expect(round(cylinderVolumeBbl(12.25, 1000), 1)).toBe(145.8);
  });

  it('refuses a zero diameter', () => {
    expect(() => cylinderVolumeBbl(0, 100)).toThrow(/above zero/);
  });
});

describe('describeVolume', () => {
  it('fills in every unit', () => {
    expect(describeVolume(500)).toEqual({
      bbl: 500,
      gal: 21000,
      cubicFeet: 2807.3,
      cubicMetres: 79.49,
    });
  });
});
