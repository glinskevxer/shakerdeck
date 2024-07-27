import { describe, it, expect } from 'vitest';
import {
  WINDOW_PROPERTIES,
  readSection,
  readProgramme,
  sectionAt,
  compareToWindow,
  checkAgainstWindow,
} from '../../src/program/window.js';

const programme = {
  well: 'brazos 14-3',
  sections: [
    {
      name: 'surface',
      fromFeet: 0,
      toFeet: 6000,
      holeSizeInches: 12.25,
      limits: {
        weightPpg: { min: 8.9, max: 9.6 },
        funnelSeconds: { min: 32, max: 45 },
        filtrateApiMl: { max: 15 },
      },
    },
    {
      name: 'intermediate',
      fromFeet: 6000,
      toFeet: 11000,
      holeSizeInches: 8.5,
      limits: {
        weightPpg: { min: 12, max: 12.8 },
        plasticViscosity: { max: 26 },
        yieldPoint: { min: 14, max: 24 },
        filtrateApiMl: { max: 6 },
        ph: { min: 9, max: 10.5 },
        sandPercent: { max: 0.5 },
      },
    },
  ],
};

describe('readSection', () => {
  it('reads a section and its windows', () => {
    const section = readSection(programme.sections[1]);
    expect(section.name).toBe('intermediate');
    expect(section.limits.weightPpg).toEqual({ min: 12, max: 12.8 });
    expect(section.limits.filtrateApiMl).toEqual({ min: null, max: 6 });
  });

  it('refuses a section that does not go down', () => {
    expect(() => readSection({ ...programme.sections[0], toFeet: 0 })).toThrow(/must be above 0/);
  });

  it('refuses a window with neither end', () => {
    expect(() => readSection({ ...programme.sections[0], limits: { weightPpg: {} } })).toThrow(
      /needs a min, a max, or both/
    );
  });

  it('refuses a window that runs backwards', () => {
    expect(() =>
      readSection({ ...programme.sections[0], limits: { weightPpg: { min: 12, max: 9 } } })
    ).toThrow(/runs backwards/);
  });

  it('refuses a property it has no window for', () => {
    expect(() =>
      readSection({ ...programme.sections[0], limits: { gelStrength: { max: 20 } } })
    ).toThrow(/no window for gelStrength/);
  });

  it('reads a section with no windows at all', () => {
    expect(readSection({ name: 'riserless', fromFeet: 0, toFeet: 500 }).limits).toEqual({});
  });
});

describe('readProgramme', () => {
  it('reads every section', () => {
    expect(readProgramme(programme).sections).toHaveLength(2);
  });

  it('refuses sections with a gap between them', () => {
    expect(() =>
      readProgramme({
        ...programme,
        sections: [programme.sections[0], { ...programme.sections[1], fromFeet: 6500 }],
      })
    ).toThrow(/starts at 6500 where surface ended at 6000/);
  });

  it('refuses a programme with no sections', () => {
    expect(() => readProgramme({ well: 'x', sections: [] })).toThrow(/at least one section/);
  });
});

describe('sectionAt', () => {
  const read = readProgramme(programme);

  it('places a depth in its section', () => {
    expect(sectionAt(read, 3000).name).toBe('surface');
    expect(sectionAt(read, 10450).name).toBe('intermediate');
  });

  it('gives a shoe depth to the section above it', () => {
    expect(sectionAt(read, 6000).name).toBe('surface');
  });

  it('reads surface as the first section', () => {
    expect(sectionAt(read, 0).name).toBe('surface');
  });

  it('is nothing below the deepest section', () => {
    expect(sectionAt(read, 12000)).toBe(null);
  });
});

describe('compareToWindow', () => {
  it('is nothing when the reading is inside', () => {
    expect(compareToWindow('weightPpg', 12.4, { min: 12, max: 12.8 })).toBe(null);
  });

  it('reports how far below', () => {
    expect(compareToWindow('weightPpg', 11.6, { min: 12, max: 12.8 })).toMatchObject({
      side: 'below',
      byHowMuch: 0.4,
      limit: 12,
      label: 'mud weight',
    });
  });

  it('reports how far above', () => {
    expect(compareToWindow('filtrateApiMl', 8.2, { min: null, max: 6 })).toMatchObject({
      side: 'above',
      byHowMuch: 2.2,
    });
  });

  it('is nothing when there is no window or no reading', () => {
    expect(compareToWindow('weightPpg', 12.4, null)).toBe(null);
    expect(compareToWindow('weightPpg', null, { min: 12, max: 12.8 })).toBe(null);
  });

  it('takes both edges as inside', () => {
    expect(compareToWindow('weightPpg', 12, { min: 12, max: 12.8 })).toBe(null);
    expect(compareToWindow('weightPpg', 12.8, { min: 12, max: 12.8 })).toBe(null);
  });

  it('carries the unit for the report', () => {
    expect(compareToWindow('ph', 8.4, { min: 9, max: 10.5 }).unit).toBe('');
    expect(compareToWindow('chlorideMgL', 90000, { max: 50000 }).unit).toBe('mg/l');
  });
});

describe('checkAgainstWindow', () => {
  const section = readProgramme(programme).sections[1];

  it('passes a mud inside the whole window', () => {
    const result = checkAgainstWindow(
      {
        weightPpg: 12.4,
        plasticViscosity: 22,
        yieldPoint: 20,
        filtrateApiMl: 4.8,
        ph: 9.6,
        sandPercent: 0.25,
      },
      section
    );
    expect(result.inWindow).toBe(true);
    expect(result.exceptions).toEqual([]);
  });

  it('lists every reading that is out', () => {
    const result = checkAgainstWindow(
      { weightPpg: 13.2, plasticViscosity: 31, filtrateApiMl: 8.2, ph: 9.6 },
      section
    );
    expect(result.exceptions.map((row) => row.property)).toEqual([
      'weightPpg',
      'plasticViscosity',
      'filtrateApiMl',
    ]);
    expect(result.inWindow).toBe(false);
  });

  it('ignores a reading the programme has no window for', () => {
    const result = checkAgainstWindow({ mbtLbBbl: 40, weightPpg: 12.4 }, section);
    expect(result.inWindow).toBe(true);
  });

  it('ignores a reading that was not taken', () => {
    expect(checkAgainstWindow({}, section).inWindow).toBe(true);
  });

  it('names the section it judged against', () => {
    expect(checkAgainstWindow({ weightPpg: 12.4 }, section).section).toBe('intermediate');
  });

  it('covers every property it knows about', () => {
    expect(Object.keys(WINDOW_PROPERTIES)).toHaveLength(10);
  });
});
