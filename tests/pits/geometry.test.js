import { describe, it, expect } from 'vitest';
import {
  rectangularVolume,
  slopedBottomVolume,
  verticalCylinderVolume,
  horizontalCylinderVolume,
  tankVolume,
  barrelsPerFoot,
  describeTank,
} from '../../src/pits/geometry.js';
import { round } from '../../src/util/number.js';

const box = { shape: 'rectangular', lengthFeet: 20, widthFeet: 10 };
const sloped = {
  shape: 'sloped',
  lengthFeet: 20,
  widthFeet: 10,
  bottomWidthFeet: 4,
  slopeHeightFeet: 3,
};
const tripTank = { shape: 'horizontal cylinder', diameterFeet: 6, lengthFeet: 20 };

describe('rectangularVolume', () => {
  it('reads a plain box', () => {
    expect(round(rectangularVolume({ lengthFeet: 20, widthFeet: 10, levelFeet: 6 }), 1)).toBe(
      213.7
    );
  });

  it('is empty at no level', () => {
    expect(rectangularVolume({ lengthFeet: 20, widthFeet: 10, levelFeet: 0 })).toBe(0);
  });

  it('goes straight with level', () => {
    const half = rectangularVolume({ lengthFeet: 20, widthFeet: 10, levelFeet: 3 });
    const full = rectangularVolume({ lengthFeet: 20, widthFeet: 10, levelFeet: 6 });
    expect(full / half).toBeCloseTo(2, 10);
  });
});

describe('slopedBottomVolume', () => {
  it('holds less than a box of the same size', () => {
    const level = 6;
    expect(slopedBottomVolume({ ...sloped, levelFeet: level })).toBeLessThan(
      rectangularVolume({ lengthFeet: 20, widthFeet: 10, levelFeet: level })
    );
    expect(round(slopedBottomVolume({ ...sloped, levelFeet: level }), 1)).toBe(181.7);
  });

  it('reads far less than a box down in the slope', () => {
    const inSlope = slopedBottomVolume({ ...sloped, levelFeet: 1.5 });
    const asBox = rectangularVolume({ lengthFeet: 20, widthFeet: 10, levelFeet: 1.5 });
    expect(round(inSlope, 1)).toBe(29.4);
    expect(inSlope).toBeLessThan(asBox * 0.6);
  });

  it('is a box again above the top of the slope', () => {
    const atSlope = slopedBottomVolume({ ...sloped, levelFeet: 3 });
    const oneFootUp = slopedBottomVolume({ ...sloped, levelFeet: 4 });
    expect(oneFootUp - atSlope).toBeCloseTo(
      rectangularVolume({ lengthFeet: 20, widthFeet: 10, levelFeet: 1 }),
      8
    );
  });

  it('reads a flat bottomed tank as a box', () => {
    expect(
      slopedBottomVolume({
        lengthFeet: 20,
        widthFeet: 10,
        bottomWidthFeet: 10,
        slopeHeightFeet: 3,
        levelFeet: 6,
      })
    ).toBeCloseTo(rectangularVolume({ lengthFeet: 20, widthFeet: 10, levelFeet: 6 }), 8);
  });

  it('refuses a tank wider at the bottom than the top', () => {
    expect(() => slopedBottomVolume({ ...sloped, bottomWidthFeet: 12, levelFeet: 6 })).toThrow(
      /wider than the top/
    );
  });
});

describe('verticalCylinderVolume', () => {
  it('reads a round tank', () => {
    expect(round(verticalCylinderVolume({ diameterFeet: 10, levelFeet: 6 }), 1)).toBe(83.9);
  });

  it('goes with the square of the diameter', () => {
    const small = verticalCylinderVolume({ diameterFeet: 5, levelFeet: 6 });
    const large = verticalCylinderVolume({ diameterFeet: 10, levelFeet: 6 });
    expect(large / small).toBeCloseTo(4, 10);
  });
});

describe('horizontalCylinderVolume', () => {
  it('is half the tank at half the diameter', () => {
    const half = horizontalCylinderVolume({ diameterFeet: 6, lengthFeet: 20, levelFeet: 3 });
    const full = horizontalCylinderVolume({ diameterFeet: 6, lengthFeet: 20, levelFeet: 6 });
    expect(half * 2).toBeCloseTo(full, 8);
    expect(round(full, 1)).toBe(100.7);
  });

  it('is nearly empty at a low level, unlike a box', () => {
    const low = horizontalCylinderVolume({ diameterFeet: 6, lengthFeet: 20, levelFeet: 0.5 });
    expect(low).toBeLessThan(5);
  });

  it('is empty at no level', () => {
    expect(horizontalCylinderVolume({ diameterFeet: 6, lengthFeet: 20, levelFeet: 0 })).toBe(0);
  });

  it('refuses a level over the top', () => {
    expect(() =>
      horizontalCylinderVolume({ diameterFeet: 6, lengthFeet: 20, levelFeet: 7 })
    ).toThrow(/over the top of a 6 foot tank/);
  });
});

describe('tankVolume', () => {
  it('dispatches on the shape in the rig book', () => {
    expect(tankVolume(box, 6)).toBeCloseTo(213.73, 2);
    expect(tankVolume(sloped, 6)).toBeCloseTo(181.67, 2);
    expect(tankVolume({ shape: 'vertical cylinder', diameterFeet: 10 }, 6)).toBeCloseTo(83.93, 2);
    expect(tankVolume(tripTank, 3)).toBeCloseTo(50.36, 2);
  });

  it('assumes a box when no shape is given', () => {
    expect(tankVolume({ lengthFeet: 20, widthFeet: 10 }, 6)).toBeCloseTo(213.73, 2);
  });

  it('refuses a shape it does not know', () => {
    expect(() => tankVolume({ shape: 'conical' }, 6)).toThrow(/unknown tank shape: conical/);
  });
});

describe('barrelsPerFoot', () => {
  it('is the same all the way up a box', () => {
    expect(barrelsPerFoot(box, 1)).toBeCloseTo(barrelsPerFoot(box, 5), 6);
  });

  it('changes with level on a sloped tank', () => {
    expect(barrelsPerFoot(sloped, 0.5)).toBeLessThan(barrelsPerFoot(sloped, 4));
  });

  it('shows why a figure painted on the tank misleads near the bottom', () => {
    const painted = barrelsPerFoot(sloped, 5);
    const actual = barrelsPerFoot(sloped, 0.2);
    expect(actual).toBeLessThan(painted * 0.6);
  });
});

describe('describeTank', () => {
  it('is the line the pit report prints', () => {
    expect(describeTank({ name: 'pit 1', ...sloped }, 6)).toEqual({
      name: 'pit 1',
      shape: 'sloped',
      levelFeet: 6,
      volumeBbl: 181.7,
      barrelsPerFoot: 35.62,
    });
  });

  it('falls back to a generic name and shape', () => {
    const row = describeTank({ lengthFeet: 20, widthFeet: 10 }, 6);
    expect(row.name).toBe('tank');
    expect(row.shape).toBe('rectangular');
  });
});
