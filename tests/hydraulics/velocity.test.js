import { describe, it, expect } from 'vitest';
import {
  VELOCITY_CONSTANT,
  pipeVelocity,
  annularVelocity,
  velocityFromCapacity,
  feetPerSecond,
  hydraulicDiameter,
  flowForVelocity,
  annularProfile,
  slowestAnnulus,
} from '../../src/hydraulics/velocity.js';
import { round } from '../../src/util/number.js';

const rows = [
  { holeName: 'casing', pipeName: 'drill pipe', idInches: 8.681, odInches: 5, lengthFeet: 6000 },
  { holeName: 'open hole', pipeName: 'drill pipe', idInches: 8.5, odInches: 5, lengthFeet: 3400 },
  { holeName: 'open hole', pipeName: 'collars', idInches: 8.5, odInches: 6.5, lengthFeet: 600 },
];

describe('pipeVelocity', () => {
  it('uses the field constant', () => {
    expect(VELOCITY_CONSTANT).toBe(24.5);
  });

  it('reads the velocity inside drill pipe', () => {
    expect(round(pipeVelocity(600, 4.276), 1)).toBe(804);
  });

  it('is zero with the pump off', () => {
    expect(pipeVelocity(0, 4.276)).toBe(0);
  });

  it('refuses a pipe with no bore', () => {
    expect(() => pipeVelocity(600, 0)).toThrow(/above zero/);
  });
});

describe('annularVelocity', () => {
  it('reads the open hole against drill pipe', () => {
    expect(round(annularVelocity(600, 8.5, 5), 1)).toBe(311.1);
  });

  it('runs faster past the collars, where the gap is tighter', () => {
    expect(round(annularVelocity(600, 8.5, 6.5), 1)).toBe(490);
  });

  it('runs slower inside casing, which is wider than the hole', () => {
    expect(round(annularVelocity(600, 8.681, 5), 1)).toBe(291.9);
  });

  it('refuses a string that does not fit', () => {
    expect(() => annularVelocity(600, 8.5, 8.5)).toThrow(/does not fit/);
  });
});

describe('velocityFromCapacity', () => {
  it('agrees with the diameters it came from', () => {
    expect(round(velocityFromCapacity(600, 0.0459), 1)).toBe(311.2);
  });

  it('refuses a zero capacity', () => {
    expect(() => velocityFromCapacity(600, 0)).toThrow(/above zero/);
  });
});

describe('feetPerSecond', () => {
  it('converts a velocity', () => {
    expect(feetPerSecond(300)).toBe(5);
  });
});

describe('hydraulicDiameter', () => {
  it('is the difference of the two diameters', () => {
    expect(hydraulicDiameter(8.5, 5)).toBe(3.5);
    expect(hydraulicDiameter(8.5, 0)).toBe(8.5);
  });

  it('refuses a string that does not fit', () => {
    expect(() => hydraulicDiameter(8.5, 9)).toThrow(/does not fit/);
  });
});

describe('flowForVelocity', () => {
  it('answers the question the way the floor asks it', () => {
    expect(round(flowForVelocity(100, 8.5, 5), 1)).toBe(192.9);
  });

  it('inverts the velocity it came from', () => {
    expect(annularVelocity(flowForVelocity(120, 8.5, 5), 8.5, 5)).toBeCloseTo(120, 9);
  });

  it('refuses a string that does not fit', () => {
    expect(() => flowForVelocity(100, 8.5, 10)).toThrow(/does not fit/);
  });
});

describe('annularProfile', () => {
  it('reports every length, slowest first', () => {
    const profile = annularProfile(rows, 600);
    expect(profile.map((row) => row.velocityFeetPerMinute)).toEqual([291.9, 311.1, 490]);
  });

  it('carries the length each velocity applies over', () => {
    expect(annularProfile(rows, 600)[0]).toMatchObject({
      holeName: 'casing',
      lengthFeet: 6000,
    });
  });
});

describe('slowestAnnulus', () => {
  it('finds the length where cuttings pile up', () => {
    expect(slowestAnnulus(rows, 600)).toMatchObject({
      holeName: 'casing',
      velocityFeetPerMinute: 291.9,
    });
  });

  it('is not the length anybody quotes', () => {
    const quoted = annularVelocity(600, 8.5, 6.5);
    expect(slowestAnnulus(rows, 600).velocityFeetPerMinute).toBeLessThan(quoted);
  });

  it('refuses an empty annulus', () => {
    expect(() => slowestAnnulus([], 600)).toThrow(/no annulus/);
  });
});
