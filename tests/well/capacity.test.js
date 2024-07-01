import { describe, it, expect } from 'vitest';
import {
  CAPACITY_CONSTANT,
  boreCapacity,
  annularCapacity,
  steelDisplacement,
  closedEndDisplacement,
  volumeOver,
  lengthFor,
  describeSection,
} from '../../src/well/capacity.js';
import { round } from '../../src/util/number.js';

describe('boreCapacity', () => {
  it('uses the industry constant', () => {
    expect(CAPACITY_CONSTANT).toBe(1029.4);
  });

  it('reads a drill pipe bore', () => {
    expect(round(boreCapacity(4.276), 5)).toBe(0.01776);
  });

  it('reads a casing bore', () => {
    expect(round(boreCapacity(8.681), 4)).toBe(0.0732);
  });

  it('refuses a zero bore', () => {
    expect(() => boreCapacity(0)).toThrow(/above zero/);
  });
});

describe('annularCapacity', () => {
  it('reads drill pipe in open hole', () => {
    expect(round(annularCapacity(8.5, 5), 5)).toBe(0.0459);
  });

  it('reads collars in open hole, which is much tighter', () => {
    expect(round(annularCapacity(8.5, 6.5), 5)).toBe(0.02914);
  });

  it('reads drill pipe inside casing', () => {
    expect(round(annularCapacity(8.681, 5), 5)).toBe(0.04892);
  });

  it('allows an empty hole, where the pipe is zero', () => {
    expect(round(annularCapacity(8.5, 0), 5)).toBe(round(boreCapacity(8.5), 5));
  });

  it('refuses a string that does not fit', () => {
    expect(() => annularCapacity(8.5, 8.5)).toThrow(
      /a 8.5 inch pipe does not fit in a 8.5 inch hole/
    );
    expect(() => annularCapacity(8.5, 9.625)).toThrow(/does not fit/);
  });
});

describe('steelDisplacement', () => {
  it('reads a joint of five inch drill pipe', () => {
    expect(round(steelDisplacement(5, 4.276), 5)).toBe(0.00652);
  });

  it('reads a drill collar, which is nearly solid', () => {
    expect(round(steelDisplacement(6.5, 2.8125), 5)).toBe(0.03336);
  });

  it('refuses a bore wider than the body', () => {
    expect(() => steelDisplacement(5, 5)).toThrow(/not smaller/);
    expect(() => steelDisplacement(5, 6)).toThrow(/not smaller/);
  });
});

describe('closedEndDisplacement', () => {
  it('is the whole outside area when nothing fills the bore', () => {
    expect(closedEndDisplacement(5)).toBeCloseTo(boreCapacity(5), 12);
    expect(round(closedEndDisplacement(5), 5)).toBe(0.02429);
  });
});

describe('volumeOver and lengthFor', () => {
  it('turns a capacity into a volume', () => {
    expect(round(volumeOver(0.01776, 9500), 1)).toBe(168.7);
  });

  it('turns a volume back into a length', () => {
    expect(round(lengthFor(168.72, 0.01776), 0)).toBe(9500);
  });

  it('allows a negative volume, which is a loss', () => {
    expect(round(volumeOver(0.0459, -100), 2)).toBe(-4.59);
  });

  it('refuses a zero capacity on the inverse', () => {
    expect(() => lengthFor(10, 0)).toThrow(/above zero/);
  });
});

describe('describeSection', () => {
  it('works out both capacities for a tally line', () => {
    const row = describeSection({
      name: 'drill pipe',
      odInches: 5,
      idInches: 4.276,
      lengthFeet: 9500,
    });
    expect(row).toEqual({
      name: 'drill pipe',
      odInches: 5,
      idInches: 4.276,
      lengthFeet: 9500,
      capacityBblPerFoot: 0.01776,
      displacementBblPerFoot: 0.00652,
      capacityBbl: 168.74,
      displacementBbl: 61.98,
      totalBbl: 230.72,
    });
  });

  it('names the section in the error', () => {
    expect(() => describeSection({ name: 'collars', odInches: 6.5 })).toThrow(/collars idInches/);
  });

  it('falls back to a generic name', () => {
    expect(() => describeSection({})).toThrow(/section odInches/);
  });
});
