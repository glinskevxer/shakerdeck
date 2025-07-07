import { describe, it, expect } from 'vitest';
import {
  BAR_PER_PSI,
  KPA_PER_PSI,
  PSI_PER_ATMOSPHERE,
  psiToBar,
  barToPsi,
  psiToKilopascal,
  kilopascalToPsi,
  psiToAtmospheres,
  psiToEquivalentWeight,
  equivalentWeightToPsi,
  describePressure,
  describeGradient,
} from '../../src/units/pressure.js';
import { round } from '../../src/util/number.js';

describe('the constants', () => {
  it('are the standard conversions', () => {
    expect(BAR_PER_PSI).toBeCloseTo(0.0689476, 7);
    expect(KPA_PER_PSI).toBeCloseTo(6.89476, 5);
    expect(PSI_PER_ATMOSPHERE).toBeCloseTo(14.6959, 4);
  });

  it('keep bar and kilopascals a thousand apart', () => {
    expect(KPA_PER_PSI / BAR_PER_PSI).toBeCloseTo(100, 6);
  });
});

describe('psi and bar', () => {
  it('converts a standpipe pressure', () => {
    expect(round(psiToBar(3000), 1)).toBe(206.8);
    expect(round(barToPsi(206.84), 0)).toBe(3000);
  });

  it('round trips', () => {
    expect(barToPsi(psiToBar(4586))).toBeCloseTo(4586, 6);
  });

  it('takes a negative pressure, which is a swab', () => {
    expect(psiToBar(-130)).toBeLessThan(0);
  });
});

describe('psi and kilopascals', () => {
  it('converts both ways', () => {
    expect(round(psiToKilopascal(3000), 0)).toBe(20684);
    expect(round(kilopascalToPsi(20684), 0)).toBe(3000);
  });
});

describe('psiToAtmospheres', () => {
  it('reads atmospheric pressure as one', () => {
    expect(psiToAtmospheres(PSI_PER_ATMOSPHERE)).toBeCloseTo(1, 9);
  });
});

describe('equivalent weight', () => {
  it('needs a depth to mean anything', () => {
    expect(round(psiToEquivalentWeight({ psi: 6448, tvdFeet: 10000 }), 2)).toBe(12.4);
    expect(round(equivalentWeightToPsi({ ppg: 12.4, tvdFeet: 10000 }), 0)).toBe(6448);
  });

  it('reads the same pressure as a different weight at a different depth', () => {
    expect(psiToEquivalentWeight({ psi: 6448, tvdFeet: 5000 })).toBeCloseTo(
      psiToEquivalentWeight({ psi: 6448, tvdFeet: 10000 }) * 2,
      6
    );
  });

  it('round trips', () => {
    expect(
      psiToEquivalentWeight({
        psi: equivalentWeightToPsi({ ppg: 14.2, tvdFeet: 9000 }),
        tvdFeet: 9000,
      })
    ).toBeCloseTo(14.2, 9);
  });

  it('refuses a depth of nothing', () => {
    expect(() => psiToEquivalentWeight({ psi: 6448, tvdFeet: 0 })).toThrow(/above zero/);
  });
});

describe('describePressure', () => {
  it('fills in every unit', () => {
    const described = describePressure(3000);
    expect(described.psi).toBe(3000);
    expect(described.bar).toBe(206.84);
    expect(described.kilopascal).toBe(20684);
    expect(described.atmospheres).toBe(204.14);
  });

  it('adds the equivalent weight when a depth is given', () => {
    expect(describePressure(6448, { tvdFeet: 10000 }).equivalentPpg).toBe(12.4);
  });

  it('leaves it out when one is not', () => {
    expect(describePressure(3000).equivalentPpg).toBe(null);
  });

  it('honours a wider decimal request', () => {
    expect(describePressure(3000.456, { decimals: 2 }).psi).toBe(3000.46);
  });
});

describe('describeGradient', () => {
  it('converts a gradient into a mud weight', () => {
    expect(describeGradient(0.6448).ppg).toBe(12.4);
  });

  it('converts it into metric', () => {
    expect(describeGradient(0.6448).barPerMetre).toBeGreaterThan(0);
  });

  it('refuses a gradient of nothing', () => {
    expect(() => describeGradient(0)).toThrow(/above zero/);
  });
});
