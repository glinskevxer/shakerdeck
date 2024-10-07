import { describe, it, expect } from 'vitest';
import {
  ATMOSPHERIC_PSI,
  gasCutPressureLoss,
  naiveGasCutLoss,
  classifyGas,
  tripGasTrend,
} from '../../src/mudcheck/gas.js';

describe('gasCutPressureLoss', () => {
  it('costs single figures of psi for a pound of cut', () => {
    const loss = gasCutPressureLoss({ uncutPpg: 12.4, cutPpg: 11.4, tvdFeet: 10000 });
    expect(loss.lossPsi).toBeGreaterThan(5);
    expect(loss.lossPsi).toBeLessThan(12);
  });

  it('is nothing for mud that is not cut', () => {
    expect(gasCutPressureLoss({ uncutPpg: 12.4, cutPpg: 12.4, tvdFeet: 10000 }).lossPsi).toBe(0);
  });

  it('is worth a fraction of a pound of equivalent weight', () => {
    expect(
      gasCutPressureLoss({ uncutPpg: 12.4, cutPpg: 11.4, tvdFeet: 10000 }).equivalentPpg
    ).toBeLessThan(0.02);
  });

  it('grows with the cut', () => {
    const light = gasCutPressureLoss({ uncutPpg: 12.4, cutPpg: 12.1, tvdFeet: 10000 });
    const heavy = gasCutPressureLoss({ uncutPpg: 12.4, cutPpg: 10.4, tvdFeet: 10000 });
    expect(heavy.lossPsi).toBeGreaterThan(light.lossPsi);
  });

  it('uses atmospheric pressure at the flowline', () => {
    expect(ATMOSPHERIC_PSI).toBe(14.7);
  });

  it('refuses a cut heavier than the mud', () => {
    expect(() => gasCutPressureLoss({ uncutPpg: 12.4, cutPpg: 13, tvdFeet: 10000 })).toThrow(
      /heavier than the 12.4/
    );
  });
});

describe('naiveGasCutLoss', () => {
  it('is the figure somebody quotes on the radio', () => {
    expect(naiveGasCutLoss({ uncutPpg: 12.4, cutPpg: 11.4, tvdFeet: 10000 })).toBe(520);
  });

  it('is very much larger than the real one', () => {
    const real = gasCutPressureLoss({ uncutPpg: 12.4, cutPpg: 11.4, tvdFeet: 10000 }).lossPsi;
    expect(naiveGasCutLoss({ uncutPpg: 12.4, cutPpg: 11.4, tvdFeet: 10000 })).toBeGreaterThan(
      real * 40
    );
  });
});

describe('classifyGas', () => {
  it('reads a background reading at background as normal', () => {
    expect(classifyGas({ units: 40, backgroundUnits: 40, kind: 'background' }).level).toBe(
      'normal'
    );
  });

  it('watches background that has doubled', () => {
    expect(classifyGas({ units: 120, backgroundUnits: 40, kind: 'background' }).level).toBe(
      'worth watching'
    );
  });

  it('calls background that has gone up five times significant', () => {
    expect(classifyGas({ units: 300, backgroundUnits: 40, kind: 'background' }).level).toBe(
      'significant'
    );
  });

  it('judges connection gas against how far over background it is', () => {
    expect(classifyGas({ units: 90, backgroundUnits: 40, kind: 'connection' }).level).toBe(
      'worth watching'
    );
    expect(classifyGas({ units: 250, backgroundUnits: 40, kind: 'connection' }).level).toBe(
      'significant'
    );
  });

  it('reports the ratio where there is a background to compare to', () => {
    expect(classifyGas({ units: 120, backgroundUnits: 40, kind: 'background' }).ratio).toBe(3);
    expect(classifyGas({ units: 120, backgroundUnits: 0, kind: 'background' }).ratio).toBe(null);
  });
});

describe('tripGasTrend', () => {
  it('warns when the gas climbs on the same weight', () => {
    const trend = tripGasTrend([
      { date: '2024-11-10', depthFeet: 9500, units: 120, weightPpg: 12.4 },
      { date: '2024-11-18', depthFeet: 10200, units: 340, weightPpg: 12.4 },
    ]);
    expect(trend.verdict).toMatch(/overbalance is falling/);
    expect(trend.changedUnits).toBe(220);
  });

  it('says the weight up worked when the gas came down', () => {
    expect(
      tripGasTrend([
        { date: '2024-11-10', depthFeet: 9500, units: 340, weightPpg: 12.4 },
        { date: '2024-11-18', depthFeet: 10200, units: 120, weightPpg: 12.8 },
      ]).verdict
    ).toMatch(/weight up worked/);
  });

  it('flags gas climbing despite a heavier mud', () => {
    expect(
      tripGasTrend([
        { date: '2024-11-10', depthFeet: 9500, units: 120, weightPpg: 12.4 },
        { date: '2024-11-18', depthFeet: 10200, units: 340, weightPpg: 12.9 },
      ]).verdict
    ).toMatch(/despite a heavier mud/);
  });

  it('is steady when nothing moved', () => {
    expect(
      tripGasTrend([
        { date: '2024-11-10', depthFeet: 9500, units: 120, weightPpg: 12.4 },
        { date: '2024-11-18', depthFeet: 10200, units: 120, weightPpg: 12.4 },
      ]).verdict
    ).toBe('steady');
  });

  it('names the trip that is wrong', () => {
    expect(() =>
      tripGasTrend([
        { date: 'a', depthFeet: 9500, units: 120, weightPpg: 12.4 },
        { date: 'b', depthFeet: 10200, units: 120 },
      ])
    ).toThrow(/trip 2 weightPpg/);
  });

  it('refuses a single trip', () => {
    expect(() => tripGasTrend([{ date: 'a', depthFeet: 1, units: 1, weightPpg: 1 }])).toThrow(
      /at least two trips/
    );
  });
});
