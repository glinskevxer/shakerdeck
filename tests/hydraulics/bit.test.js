import { describe, it, expect } from 'vitest';
import {
  DISCHARGE_COEFFICIENT,
  totalFlowArea,
  bitPressureDrop,
  nozzleVelocity,
  hydraulicHorsepower,
  horsepowerPerSquareInch,
  jetImpactForce,
  bitSummary,
} from '../../src/hydraulics/bit.js';
import { round } from '../../src/util/number.js';

describe('totalFlowArea', () => {
  it('adds three thirteens up', () => {
    expect(round(totalFlowArea([13, 13, 13]), 4)).toBe(0.3889);
  });

  it('adds a mixed set', () => {
    expect(totalFlowArea([13, 13, 14])).toBeGreaterThan(totalFlowArea([13, 13, 13]));
  });

  it('goes with the square of the size', () => {
    expect(totalFlowArea([16]) / totalFlowArea([8])).toBeCloseTo(4, 10);
  });

  it('refuses a bit with no nozzles', () => {
    expect(() => totalFlowArea([])).toThrow(/at least one nozzle/);
    expect(() => totalFlowArea(null)).toThrow(/at least one nozzle/);
  });

  it('names the nozzle that is wrong', () => {
    expect(() => totalFlowArea([13, 0, 13])).toThrow(/nozzle 2 must be above zero/);
  });
});

describe('bitPressureDrop', () => {
  it('uses the discharge coefficient of a drilled nozzle', () => {
    expect(DISCHARGE_COEFFICIENT).toBe(0.95);
  });

  it('reads a working bit', () => {
    const drop = bitPressureDrop({
      flowGpm: 600,
      totalFlowAreaSquareInches: totalFlowArea([13, 13, 13]),
      densityPpg: 12.4,
    });
    expect(round(drop, 0)).toBe(2719);
  });

  it('goes with the square of the rate', () => {
    const area = totalFlowArea([13, 13, 13]);
    const slow = bitPressureDrop({
      flowGpm: 300,
      totalFlowAreaSquareInches: area,
      densityPpg: 12.4,
    });
    const fast = bitPressureDrop({
      flowGpm: 600,
      totalFlowAreaSquareInches: area,
      densityPpg: 12.4,
    });
    expect(fast / slow).toBeCloseTo(4, 8);
  });

  it('falls with the square of the flow area', () => {
    const small = bitPressureDrop({
      flowGpm: 600,
      totalFlowAreaSquareInches: totalFlowArea([13, 13, 13]),
      densityPpg: 12.4,
    });
    const large = bitPressureDrop({
      flowGpm: 600,
      totalFlowAreaSquareInches: totalFlowArea([16, 16, 16]),
      densityPpg: 12.4,
    });
    expect(small / large).toBeCloseTo((0.589 / 0.3889) ** 2, 1);
  });

  it('is nothing with the pump off', () => {
    expect(
      bitPressureDrop({ flowGpm: 0, totalFlowAreaSquareInches: 0.3889, densityPpg: 12.4 })
    ).toBe(0);
  });

  it('refuses a plugged bit', () => {
    expect(() =>
      bitPressureDrop({ flowGpm: 600, totalFlowAreaSquareInches: 0, densityPpg: 12.4 })
    ).toThrow(/above zero/);
  });
});

describe('nozzleVelocity', () => {
  it('reads the jet velocity', () => {
    expect(round(nozzleVelocity(600, totalFlowArea([13, 13, 13])), 0)).toBe(495);
  });

  it('is zero with the pump off', () => {
    expect(nozzleVelocity(0, 0.3889)).toBe(0);
  });
});

describe('hydraulicHorsepower', () => {
  it('is pressure times rate over seventeen fourteen', () => {
    expect(hydraulicHorsepower(1714, 100)).toBeCloseTo(100, 10);
    expect(round(hydraulicHorsepower(2719, 600), 1)).toBe(951.8);
  });
});

describe('horsepowerPerSquareInch', () => {
  it('spreads the horsepower over the bottom of the hole', () => {
    expect(round(horsepowerPerSquareInch(951.6, 8.5), 2)).toBe(16.77);
  });

  it('falls sharply on a bigger bit', () => {
    expect(horsepowerPerSquareInch(951.6, 12.25)).toBeLessThan(
      horsepowerPerSquareInch(951.6, 8.5) / 2
    );
  });

  it('refuses a bit with no diameter', () => {
    expect(() => horsepowerPerSquareInch(951.6, 0)).toThrow(/above zero/);
  });
});

describe('jetImpactForce', () => {
  it('reads the force on bottom', () => {
    expect(
      round(jetImpactForce({ flowGpm: 600, densityPpg: 12.4, pressureDropPsi: 2719 }), 0)
    ).toBe(1908);
  });

  it('is nothing with the pump off', () => {
    expect(jetImpactForce({ flowGpm: 0, densityPpg: 12.4, pressureDropPsi: 0 })).toBe(0);
  });
});

describe('bitSummary', () => {
  it('is the bit block of the hydraulics sheet', () => {
    expect(
      bitSummary({
        nozzleThirtySeconds: [13, 13, 13],
        flowGpm: 600,
        densityPpg: 12.4,
        bitDiameterInches: 8.5,
        systemPressurePsi: 3200,
      })
    ).toEqual({
      nozzles: [13, 13, 13],
      totalFlowArea: 0.3889,
      pressureDropPsi: 2719,
      nozzleVelocityFeetPerSecond: 495,
      hydraulicHorsepower: 951.6,
      horsepowerPerSquareInch: 16.77,
      jetImpactForceLbf: 1908,
      shareOfSystem: 0.85,
    });
  });

  it('shows a bigger nozzle set trading horsepower for nothing much', () => {
    const tight = bitSummary({
      nozzleThirtySeconds: [13, 13, 13],
      flowGpm: 600,
      densityPpg: 12.4,
      bitDiameterInches: 8.5,
    });
    const open = bitSummary({
      nozzleThirtySeconds: [16, 16, 16],
      flowGpm: 600,
      densityPpg: 12.4,
      bitDiameterInches: 8.5,
    });
    expect(open.horsepowerPerSquareInch).toBeLessThan(tight.horsepowerPerSquareInch / 2);
    expect(open.jetImpactForceLbf).toBeLessThan(tight.jetImpactForceLbf);
  });

  it('leaves the share out when the system pressure is not known', () => {
    expect(
      bitSummary({
        nozzleThirtySeconds: [13, 13, 13],
        flowGpm: 600,
        densityPpg: 12.4,
        bitDiameterInches: 8.5,
      }).shareOfSystem
    ).toBe(null);
  });

  it('does not hand its own nozzle list back to be mutated', () => {
    const nozzles = [13, 13, 13];
    const summary = bitSummary({
      nozzleThirtySeconds: nozzles,
      flowGpm: 600,
      densityPpg: 12.4,
      bitDiameterInches: 8.5,
    });
    summary.nozzles.push(13);
    expect(nozzles).toHaveLength(3);
  });
});
