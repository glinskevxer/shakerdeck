import { describe, it, expect } from 'vitest';
import { readHole, readString, annulusProfile, wellVolumes } from '../../src/well/geometry.js';

const hole = {
  totalDepthFeet: 10000,
  sections: [
    { name: 'surface casing', idInches: 8.681, bottomFeet: 6000, cased: true },
    { name: 'open hole', idInches: 8.5, bottomFeet: 10000 },
  ],
};

const string = [
  { name: 'drill collars', odInches: 6.5, idInches: 2.8125, lengthFeet: 600 },
  { name: 'drill pipe', odInches: 5, idInches: 4.276, lengthFeet: 9400 },
];

describe('readHole', () => {
  it('turns bottom depths into sections with a top and a length', () => {
    const rows = readHole(hole.sections);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ topFeet: 0, bottomFeet: 6000, lengthFeet: 6000, cased: true });
    expect(rows[1]).toMatchObject({ topFeet: 6000, bottomFeet: 10000, lengthFeet: 4000 });
  });

  it('marks an unflagged section as open hole', () => {
    expect(readHole(hole.sections)[1].cased).toBe(false);
  });

  it('refuses a section that does not go deeper than the one above', () => {
    expect(() =>
      readHole([
        { idInches: 8.5, bottomFeet: 6000 },
        { idInches: 8.5, bottomFeet: 5000 },
      ])
    ).toThrow(/not below 6000/);
  });

  it('refuses an empty hole', () => {
    expect(() => readHole([])).toThrow(/at least one section/);
    expect(() => readHole(null)).toThrow(/at least one section/);
  });

  it('names the section that is short of a diameter', () => {
    expect(() => readHole([{ name: 'lead in', bottomFeet: 100 }])).toThrow(/lead in idInches/);
  });
});

describe('readString', () => {
  it('places each section against the depth it hangs at', () => {
    const rows = readString(string, 10000);
    expect(rows[0]).toMatchObject({ name: 'drill pipe', topFeet: 0, bottomFeet: 9400 });
    expect(rows[1]).toMatchObject({ name: 'drill collars', topFeet: 9400, bottomFeet: 10000 });
  });

  it('reads from the bit up and reports from surface down', () => {
    const rows = readString(string, 10000);
    expect(rows.map((row) => row.name)).toEqual(['drill pipe', 'drill collars']);
  });

  it('leaves the string off bottom when it is short', () => {
    const rows = readString(string, 10500);
    expect(rows.at(-1).bottomFeet).toBe(10500);
    expect(rows[0].topFeet).toBe(500);
  });

  it('refuses a string longer than the hole', () => {
    expect(() => readString(string, 9000)).toThrow(/10000 feet long in a 9000 foot hole/);
  });

  it('refuses an empty string', () => {
    expect(() => readString([], 10000)).toThrow(/at least one section/);
  });
});

describe('annulusProfile', () => {
  const rows = annulusProfile(readHole(hole.sections), readString(string, 10000));

  it('splits at every change of geometry', () => {
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.lengthFeet)).toEqual([6000, 3400, 600]);
  });

  it('pairs each length with the pipe that is actually in it', () => {
    expect(rows[0]).toMatchObject({
      holeName: 'surface casing',
      pipeName: 'drill pipe',
      capacityBblPerFoot: 0.04892,
      volumeBbl: 293.53,
    });
    expect(rows[2]).toMatchObject({
      holeName: 'open hole',
      pipeName: 'drill collars',
      capacityBblPerFoot: 0.02914,
      volumeBbl: 17.49,
    });
  });

  it('reports bare hole below the string as open', () => {
    const short = annulusProfile(readHole(hole.sections), readString(string, 10000).slice(0, 1));
    const open = short.filter((row) => row.pipeName === 'open');
    expect(open).toHaveLength(1);
    expect(open[0].lengthFeet).toBe(600);
    expect(open[0].odInches).toBe(0);
  });
});

describe('wellVolumes', () => {
  const volumes = wellVolumes({ hole, string });

  it('adds the annulus up section by section', () => {
    expect(volumes.annulusBbl).toBe(467.08);
  });

  it('adds the string bore up', () => {
    expect(volumes.stringBbl).toBe(171.57);
  });

  it('reports the steel the string displaces', () => {
    expect(volumes.steelDisplacementBbl).toBe(81.34);
  });

  it('reports the hole as the annulus plus the string', () => {
    expect(volumes.holeVolumeBbl).toBe(638.65);
  });

  it('applies washout to open hole only', () => {
    const washed = wellVolumes({ hole, string, washoutFraction: 0.1 });
    expect(washed.annulusBbl).toBe(484.43);
    expect(washed.stringBbl).toBe(volumes.stringBbl);
  });

  it('accepts the sections as a bare list', () => {
    const bare = wellVolumes({ hole: hole.sections, string });
    expect(bare.annulusBbl).toBe(volumes.annulusBbl);
  });

  it('refuses a negative washout', () => {
    expect(() => wellVolumes({ hole, string, washoutFraction: -0.1 })).toThrow(/not be negative/);
  });
});
