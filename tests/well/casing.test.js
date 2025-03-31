import { describe, it, expect } from 'vitest';
import {
  burstLoad,
  collapseLoad,
  margin,
  heaviestMudForBurst,
  casingCheck,
} from '../../src/well/casing.js';

const string = {
  name: 'nine and five eighths surface',
  shoeTvdFeet: 6000,
  burstRatingPsi: 5750,
  collapseRatingPsi: 3090,
};

describe('burstLoad', () => {
  it('is nothing when the mud inside matches the mud outside', () => {
    expect(burstLoad({ insidePpg: 12.4, outsidePpg: 12.4, shoeTvdFeet: 6000 })).toBe(0);
  });

  it('grows with the difference', () => {
    expect(burstLoad({ insidePpg: 15, outsidePpg: 9, shoeTvdFeet: 6000 })).toBe(1872);
  });

  it('takes surface pressure straight on top', () => {
    expect(burstLoad({ insidePpg: 15, outsidePpg: 9, shoeTvdFeet: 6000, surfacePsi: 1000 })).toBe(
      2872
    );
  });

  it('goes negative when the mud outside is heavier', () => {
    expect(burstLoad({ insidePpg: 9, outsidePpg: 15, shoeTvdFeet: 6000 })).toBeLessThan(0);
  });
});

describe('collapseLoad', () => {
  it('is nothing with the same mud both sides', () => {
    expect(collapseLoad({ insidePpg: 12.4, outsidePpg: 12.4, shoeTvdFeet: 6000 })).toBe(0);
  });

  it('grows as the string is emptied', () => {
    const partly = collapseLoad({
      insidePpg: 12.4,
      outsidePpg: 12.4,
      shoeTvdFeet: 6000,
      emptyToFeet: 2000,
    });
    const fully = collapseLoad({
      insidePpg: 12.4,
      outsidePpg: 12.4,
      shoeTvdFeet: 6000,
      emptyToFeet: 6000,
    });
    expect(fully).toBeGreaterThan(partly);
  });

  it('never goes below nothing', () => {
    expect(collapseLoad({ insidePpg: 16, outsidePpg: 9, shoeTvdFeet: 6000 })).toBe(0);
  });

  it('refuses an empty depth past the shoe', () => {
    expect(() =>
      collapseLoad({ insidePpg: 12, outsidePpg: 12, shoeTvdFeet: 6000, emptyToFeet: 7000 })
    ).toThrow(/cannot be empty to 7000/);
  });
});

describe('margin', () => {
  it('reports what is left', () => {
    const left = margin({ load: 1872, ratingPsi: 5750 });
    expect(left.marginPsi).toBe(3878);
    expect(left.usedShare).toBeCloseTo(0.326, 3);
    expect(left.over).toBe(false);
  });

  it('says when the load is past the rating', () => {
    expect(margin({ load: 6000, ratingPsi: 5750 }).over).toBe(true);
  });

  it('takes a negative load, which loads the pipe the other way', () => {
    const other = margin({ load: -2371, ratingPsi: 5750 });
    expect(other.over).toBe(false);
    expect(other.marginPsi).toBeGreaterThan(5750);
  });

  it('refuses a rating of nothing', () => {
    expect(() => margin({ load: 100, ratingPsi: 0 })).toThrow(/above zero/);
  });
});

describe('heaviestMudForBurst', () => {
  it('works out how heavy the mud can go', () => {
    const heaviest = heaviestMudForBurst({
      outsidePpg: 9,
      shoeTvdFeet: 6000,
      burstRatingPsi: 5750,
    });
    expect(heaviest).toBeGreaterThan(20);
  });

  it('lands exactly on the rating', () => {
    const heaviest = heaviestMudForBurst({
      outsidePpg: 9,
      shoeTvdFeet: 6000,
      burstRatingPsi: 5750,
    });
    expect(burstLoad({ insidePpg: heaviest, outsidePpg: 9, shoeTvdFeet: 6000 })).toBeCloseTo(
      5750,
      -1
    );
  });

  it('comes down when there is surface pressure on it', () => {
    expect(
      heaviestMudForBurst({
        outsidePpg: 9,
        shoeTvdFeet: 6000,
        burstRatingPsi: 5750,
        surfacePsi: 2000,
      })
    ).toBeLessThan(heaviestMudForBurst({ outsidePpg: 9, shoeTvdFeet: 6000, burstRatingPsi: 5750 }));
  });
});

describe('casingCheck', () => {
  const check = casingCheck({ ...string, insidePpg: 12.4, outsidePpg: 9.2 });

  it('reports both loads against their ratings', () => {
    expect(check.burst.over).toBe(false);
    expect(check.collapse.over).toBe(false);
    expect(check.safe).toBe(true);
  });

  it('says how heavy the mud can go on this string', () => {
    expect(check.heaviestMudPpg).toBeGreaterThan(12.4);
  });

  it('fails a string with a well control pressure on top of a heavy mud', () => {
    const loaded = casingCheck({
      ...string,
      insidePpg: 17,
      outsidePpg: 9,
      surfacePsi: 3500,
    });
    expect(loaded.burst.over).toBe(true);
    expect(loaded.safe).toBe(false);
  });

  it('fails a string emptied under a heavy annulus', () => {
    const emptied = casingCheck({
      ...string,
      insidePpg: 8.4,
      outsidePpg: 16,
      emptyToFeet: 6000,
    });
    expect(emptied.collapse.over).toBe(true);
  });

  it('carries the name and the shoe for the report', () => {
    expect(check.name).toBe(string.name);
    expect(check.shoeTvdFeet).toBe(6000);
  });
});
