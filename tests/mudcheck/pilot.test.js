import { describe, it, expect } from 'vitest';
import {
  LAB_BARREL_ML,
  REPEATABILITY,
  gramsForTreatment,
  scaleToSystem,
  scaleDilutedPilot,
  pilotMoved,
  pilotSeries,
} from '../../src/mudcheck/pilot.js';

describe('gramsForTreatment', () => {
  it('makes a gram stand for a pound', () => {
    expect(LAB_BARREL_ML).toBe(350);
    expect(gramsForTreatment({ poundsPerBarrel: 2 })).toBe(2);
  });

  it('scales for a cup that is not a lab barrel', () => {
    expect(gramsForTreatment({ poundsPerBarrel: 2, cupMillilitres: 175 })).toBe(1);
  });

  it('is nothing for no treatment', () => {
    expect(gramsForTreatment({ poundsPerBarrel: 0 })).toBe(0);
  });

  it('refuses a cup of nothing', () => {
    expect(() => gramsForTreatment({ poundsPerBarrel: 2, cupMillilitres: 0 })).toThrow(
      /above zero/
    );
  });
});

describe('scaleToSystem', () => {
  it('inverts the grams for a treatment', () => {
    expect(scaleToSystem({ grams: 2, systemBbl: 800 }).poundsPerBarrel).toBe(2);
    expect(scaleToSystem({ grams: 2, systemBbl: 800 }).totalPounds).toBe(1600);
  });

  it('scales for a smaller cup', () => {
    expect(scaleToSystem({ grams: 1, cupMillilitres: 175, systemBbl: 800 }).poundsPerBarrel).toBe(
      2
    );
  });
});

describe('scaleDilutedPilot', () => {
  const scaled = scaleDilutedPilot({
    grams: 2,
    mudMillilitres: 300,
    waterMillilitres: 50,
    systemBbl: 800,
  });

  it('corrects for the water in the sample', () => {
    expect(scaled.correctedLbBbl).toBeGreaterThan(scaled.asMeasuredLbBbl);
  });

  it('reports how far light the uncorrected rate goes in', () => {
    expect(scaled.understatedBy).toBeGreaterThan(0);
    expect(scaled.dilution).toBeCloseTo(50 / 350, 3);
  });

  it('is the same either way on an undiluted pilot', () => {
    const straight = scaleDilutedPilot({
      grams: 2,
      mudMillilitres: 350,
      waterMillilitres: 0,
      systemBbl: 800,
    });
    expect(straight.understatedBy).toBe(0);
    expect(straight.dilution).toBe(0);
  });

  it('refuses a sample with no mud in it', () => {
    expect(() =>
      scaleDilutedPilot({ grams: 2, mudMillilitres: 0, waterMillilitres: 350, systemBbl: 800 })
    ).toThrow(/above zero/);
  });
});

describe('pilotMoved', () => {
  it('believes a move outside the repeatability', () => {
    const moved = pilotMoved({ property: 'filtrateApiMl', before: 8.2, after: 5.4 });
    expect(moved.believable).toBe(true);
    expect(moved.moved).toBe(-2.8);
  });

  it('does not believe a move inside it', () => {
    expect(pilotMoved({ property: 'funnelSeconds', before: 46, after: 48 }).believable).toBe(false);
  });

  it('carries the repeatability figure it judged against', () => {
    expect(pilotMoved({ property: 'ph', before: 9.4, after: 9.9 }).repeatability).toBe(0.2);
    expect(Object.keys(REPEATABILITY)).toContain('weightPpg');
  });

  it('refuses a property with no repeatability figure', () => {
    expect(() => pilotMoved({ property: 'gels', before: 6, after: 9 })).toThrow(
      /no repeatability figure for gels/
    );
  });
});

describe('pilotSeries', () => {
  const series = pilotSeries({
    property: 'filtrateApiMl',
    target: { max: 6 },
    before: 8.2,
    systemBbl: 800,
    pilots: [
      { grams: 1, after: 7.9 },
      { grams: 2, after: 6.4 },
      { grams: 3, after: 5.6 },
      { grams: 4, after: 5.1 },
    ],
  });

  it('scales every pilot to the system', () => {
    expect(series.pilots.map((row) => row.poundsPerBarrel)).toEqual([1, 2, 3, 4]);
    expect(series.pilots[0].totalPounds).toBe(800);
  });

  it('picks the first rate that does the job and can be believed', () => {
    expect(series.chosen.grams).toBe(3);
  });

  it('does not pick a pilot that only moved inside the repeatability', () => {
    expect(series.pilots[0].believable).toBe(false);
    expect(series.chosen.grams).not.toBe(1);
  });

  it('picks nothing when no pilot got there', () => {
    const short = pilotSeries({
      property: 'filtrateApiMl',
      target: { max: 4 },
      before: 8.2,
      systemBbl: 800,
      pilots: [{ grams: 1, after: 7.9 }],
    });
    expect(short.chosen).toBe(null);
  });

  it('reads a target that has to be reached rather than stayed under', () => {
    const climbing = pilotSeries({
      property: 'yieldPoint',
      target: { min: 20 },
      before: 12,
      systemBbl: 800,
      pilots: [
        { grams: 1, after: 16 },
        { grams: 2, after: 22 },
      ],
    });
    expect(climbing.chosen.grams).toBe(2);
  });
});
