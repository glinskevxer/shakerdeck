import { describe, it, expect } from 'vitest';
import {
  METHYLENE_BLUE_FACTOR,
  BENTONITE_CEC,
  methyleneBlue,
  cationExchangeCapacity,
  clayFraction,
  bentonitePercent,
  sandVerdict,
  cakeThickness,
  filtrateAtThirtyMinutes,
  claySummary,
} from '../../src/mudcheck/clay.js';
import { round } from '../../src/util/number.js';

describe('methyleneBlue', () => {
  it('uses the api factor', () => {
    expect(METHYLENE_BLUE_FACTOR).toBe(5);
    expect(BENTONITE_CEC).toBe(70);
  });

  it('reads the bentonite equivalent off the burette', () => {
    expect(methyleneBlue(3.5)).toBe(17.5);
    expect(methyleneBlue(7, 2)).toBe(17.5);
  });

  it('reads zero on a mud that takes no dye', () => {
    expect(methyleneBlue(0)).toBe(0);
  });

  it('refuses a zero sample', () => {
    expect(() => methyleneBlue(3.5, 0)).toThrow(/above zero/);
  });
});

describe('cationExchangeCapacity', () => {
  it('is the clay capacity spread over all the solids', () => {
    expect(round(cationExchangeCapacity(17.5, 233.1), 1)).toBe(5.3);
  });

  it('reaches the pure clay figure when the solids are all clay', () => {
    expect(cationExchangeCapacity(50, 50)).toBe(BENTONITE_CEC);
  });

  it('refuses a mud with no solids', () => {
    expect(() => cationExchangeCapacity(17.5, 0)).toThrow(/above zero/);
  });
});

describe('clayFraction', () => {
  it('is the share of the low gravity solids that takes the dye', () => {
    expect(round(clayFraction(17.5, 51.3), 3)).toBe(0.341);
  });

  it('never reads above all of them', () => {
    expect(clayFraction(60, 51.3)).toBe(1);
  });

  it('is zero on a mud with no clay', () => {
    expect(clayFraction(0, 51.3)).toBe(0);
  });
});

describe('bentonitePercent', () => {
  it('converts a weight per barrel to a volume percent', () => {
    expect(round(bentonitePercent(17.5), 2)).toBe(1.92);
    expect(bentonitePercent(0)).toBe(0);
  });
});

describe('sandVerdict', () => {
  it('reads a normal mud', () => {
    expect(sandVerdict(0.25)).toEqual({ level: 'normal', sandPercent: 0.25 });
    expect(sandVerdict(0).level).toBe('normal');
  });

  it('climbs through the bands', () => {
    expect(sandVerdict(0.4).level).toBe('high');
    expect(sandVerdict(0.5).level).toBe('high');
    expect(sandVerdict(0.8).level).toBe('check the screens');
    expect(sandVerdict(1).level).toBe('check the screens');
    expect(sandVerdict(1.5).level).toBe('damaging the pumps');
  });
});

describe('cakeThickness', () => {
  it('converts the ruler reading', () => {
    expect(cakeThickness(2)).toEqual({
      thirtySecondInch: 2,
      inches: 0.0625,
      millimetres: 1.59,
    });
  });

  it('reads no cake at all', () => {
    expect(cakeThickness(0).millimetres).toBe(0);
  });
});

describe('filtrateAtThirtyMinutes', () => {
  it('doubles a seven and a half minute reading', () => {
    expect(filtrateAtThirtyMinutes(2.4, 7.5)).toBeCloseTo(4.8, 10);
  });

  it('leaves a thirty minute reading alone', () => {
    expect(filtrateAtThirtyMinutes(4.8, 30)).toBeCloseTo(4.8, 10);
  });

  it('refuses a zero length test', () => {
    expect(() => filtrateAtThirtyMinutes(2.4, 0)).toThrow(/above zero/);
  });
});

describe('claySummary', () => {
  it('is the clay block of the report', () => {
    expect(
      claySummary({ mbtLbBbl: 17.5, sandPercent: 0.25, lowGravityLbBbl: 51.3, solidsLbBbl: 233.1 })
    ).toEqual({
      bentoniteLbBbl: 17.5,
      bentonitePercent: 1.92,
      cationExchangeCapacity: 5.3,
      clayFraction: 0.341,
      sand: 'normal',
    });
  });

  it('leaves out what was not measured', () => {
    const summary = claySummary({ mbtLbBbl: 17.5 });
    expect(summary.cationExchangeCapacity).toBe(null);
    expect(summary.clayFraction).toBe(null);
    expect(summary.sand).toBe(null);
  });

  it('is nothing at all when no dye test was run', () => {
    expect(claySummary({})).toBe(null);
  });
});
