import { describe, it, expect } from 'vitest';
import {
  readStation,
  dogleg,
  ratioFactor,
  runSurvey,
  tvdAt,
  worstDogleg,
} from '../../src/well/survey.js';

const vertical = [
  { measuredDepthFeet: 0, inclinationDegrees: 0, azimuthDegrees: 0 },
  { measuredDepthFeet: 5000, inclinationDegrees: 0, azimuthDegrees: 0 },
  { measuredDepthFeet: 10000, inclinationDegrees: 0, azimuthDegrees: 0 },
];

const deviated = [
  { measuredDepthFeet: 1000, inclinationDegrees: 0, azimuthDegrees: 0 },
  { measuredDepthFeet: 3000, inclinationDegrees: 15, azimuthDegrees: 90 },
  { measuredDepthFeet: 6000, inclinationDegrees: 45, azimuthDegrees: 92 },
  { measuredDepthFeet: 9000, inclinationDegrees: 60, azimuthDegrees: 95 },
  { measuredDepthFeet: 12000, inclinationDegrees: 60, azimuthDegrees: 95 },
];

describe('readStation', () => {
  it('reads a station', () => {
    expect(readStation(deviated[1])).toEqual({
      measuredDepthFeet: 3000,
      inclinationDegrees: 15,
      azimuthDegrees: 90,
    });
  });

  it('takes a station with no azimuth on it', () => {
    expect(readStation({ measuredDepthFeet: 100, inclinationDegrees: 0 }).azimuthDegrees).toBe(0);
  });

  it('names the field that is wrong', () => {
    expect(() => readStation({ inclinationDegrees: 5 }, 'station 3')).toThrow(
      /station 3 measuredDepthFeet/
    );
  });

  it('refuses an inclination past vertical the other way', () => {
    expect(() => readStation({ measuredDepthFeet: 100, inclinationDegrees: 200 })).toThrow(
      /past vertical/
    );
  });
});

describe('dogleg and ratioFactor', () => {
  it('is nothing between two identical stations', () => {
    expect(dogleg(deviated[3], { ...deviated[3], measuredDepthFeet: 10000 })).toBeCloseTo(0, 9);
    expect(ratioFactor(0)).toBe(1);
  });

  it('is the inclination change on a straight build', () => {
    expect(
      dogleg(
        { inclinationDegrees: 15, azimuthDegrees: 90 },
        { inclinationDegrees: 45, azimuthDegrees: 90 }
      )
    ).toBeCloseTo(30, 6);
  });

  it('picks up a turn as well as a build', () => {
    const straight = dogleg(
      { inclinationDegrees: 45, azimuthDegrees: 90 },
      { inclinationDegrees: 60, azimuthDegrees: 90 }
    );
    const turning = dogleg(
      { inclinationDegrees: 45, azimuthDegrees: 90 },
      { inclinationDegrees: 60, azimuthDegrees: 120 }
    );
    expect(turning).toBeGreaterThan(straight);
  });

  it('grows the ratio factor with the dogleg', () => {
    expect(ratioFactor(30)).toBeGreaterThan(1);
    expect(ratioFactor(60)).toBeGreaterThan(ratioFactor(30));
  });
});

describe('runSurvey', () => {
  it('reads a vertical well as measured depth', () => {
    const rows = runSurvey(vertical);
    expect(rows.at(-1).tvdFeet).toBe(10000);
    expect(rows.at(-1).northFeet).toBe(0);
  });

  it('reads a deviated well far short of measured depth', () => {
    const rows = runSurvey(deviated);
    expect(rows.at(-1).tvdFeet).toBeLessThan(10000);
    expect(rows.at(-1).measuredDepthFeet).toBe(12000);
  });

  it('walks east on an easterly azimuth', () => {
    const rows = runSurvey(deviated);
    expect(rows.at(-1).eastFeet).toBeGreaterThan(3000);
    expect(Math.abs(rows.at(-1).northFeet)).toBeLessThan(rows.at(-1).eastFeet);
  });

  it('reports the severity of each course', () => {
    const rows = runSurvey(deviated);
    expect(rows[1].severityPer100).toBeCloseTo(0.75, 2);
    expect(rows.at(-1).severityPer100).toBe(0);
  });

  it('gains true vertical depth all the way down', () => {
    const rows = runSurvey(deviated);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].tvdFeet).toBeGreaterThan(rows[i - 1].tvdFeet);
    }
  });

  it('refuses a station that is not below the one above', () => {
    expect(() => runSurvey([deviated[0], { ...deviated[1], measuredDepthFeet: 500 }])).toThrow(
      /is not below 1000/
    );
  });

  it('refuses an empty survey', () => {
    expect(() => runSurvey([])).toThrow(/at least one station/);
  });
});

describe('tvdAt', () => {
  const survey = runSurvey(deviated);

  it('lands on a station exactly', () => {
    expect(tvdAt(survey, 6000)).toBe(survey[2].tvdFeet);
  });

  it('interpolates between two stations', () => {
    const between = tvdAt(survey, 7500);
    expect(between).toBeGreaterThan(survey[2].tvdFeet);
    expect(between).toBeLessThan(survey[3].tvdFeet);
  });

  it('carries on past the last station at the last inclination', () => {
    const past = tvdAt(survey, 13000);
    expect(past).toBeGreaterThan(survey.at(-1).tvdFeet);
    expect(past - survey.at(-1).tvdFeet).toBeCloseTo(1000 * Math.cos((60 * Math.PI) / 180), 1);
  });

  it('reads above the first station in proportion', () => {
    expect(tvdAt(survey, 500)).toBeCloseTo(survey[0].tvdFeet / 2, 1);
  });

  it('is measured depth all the way down a vertical well', () => {
    const straight = runSurvey(vertical);
    expect(tvdAt(straight, 7350)).toBe(7350);
  });
});

describe('worstDogleg', () => {
  it('finds the course the string will hang up in', () => {
    const worst = worstDogleg(runSurvey(deviated));
    expect(worst.measuredDepthFeet).toBe(6000);
    expect(worst.severityPer100).toBeGreaterThan(0.9);
  });

  it('finds nothing on a vertical well', () => {
    expect(worstDogleg(runSurvey(vertical)).severityPer100).toBe(0);
  });
});
