import { describe, it, expect } from 'vitest';
import {
  killMudWeight,
  circulatingPressures,
  stepDown,
  maximumAnnularPressure,
  influxGradient,
  sheetChecks,
  killSheet,
} from '../../src/wellcontrol/killsheet.js';

describe('killMudWeight', () => {
  it('balances the shut in drill pipe pressure', () => {
    expect(killMudWeight({ currentPpg: 12.4, shutInDrillPipePsi: 400, tvdFeet: 10000 })).toBe(
      13.17
    );
  });

  it('is the mud weight with nothing on the gauge', () => {
    expect(killMudWeight({ currentPpg: 12.4, shutInDrillPipePsi: 0, tvdFeet: 10000 })).toBe(12.4);
  });

  it('needs far more weight in a shallow hole', () => {
    expect(
      killMudWeight({ currentPpg: 12.4, shutInDrillPipePsi: 400, tvdFeet: 3000 })
    ).toBeGreaterThan(14.9);
  });

  it('refuses a hole with no depth', () => {
    expect(() => killMudWeight({ currentPpg: 12.4, shutInDrillPipePsi: 400, tvdFeet: 0 })).toThrow(
      /above zero/
    );
  });
});

describe('circulatingPressures', () => {
  const pressures = circulatingPressures({
    shutInDrillPipePsi: 400,
    slowPumpPsi: 650,
    currentPpg: 12.4,
    killPpg: 13.17,
  });

  it('starts at the slow pump pressure plus the drill pipe pressure', () => {
    expect(pressures.initialPsi).toBe(1050);
  });

  it('ends at the slow pump pressure scaled by the weight up', () => {
    expect(pressures.finalPsi).toBe(690);
  });

  it('ends at the slow pump pressure when nothing was weighted up', () => {
    expect(
      circulatingPressures({
        shutInDrillPipePsi: 0,
        slowPumpPsi: 650,
        currentPpg: 12.4,
        killPpg: 12.4,
      }).finalPsi
    ).toBe(650);
  });
});

describe('stepDown', () => {
  const schedule = stepDown({ initialPsi: 1050, finalPsi: 690, stringStrokes: 1970 });

  it('runs from the first stroke to the last', () => {
    expect(schedule).toHaveLength(11);
    expect(schedule[0]).toMatchObject({ strokes: 0, standpipePsi: 1050 });
    expect(schedule.at(-1)).toMatchObject({ strokes: 1970, standpipePsi: 690 });
  });

  it('falls all the way down', () => {
    for (let i = 1; i < schedule.length; i += 1) {
      expect(schedule[i].standpipePsi).toBeLessThan(schedule[i - 1].standpipePsi);
    }
  });

  it('takes a different number of steps', () => {
    expect(
      stepDown({ initialPsi: 1050, finalPsi: 690, stringStrokes: 1970, steps: 4 })
    ).toHaveLength(5);
  });

  it('refuses a fractional number of steps', () => {
    expect(() =>
      stepDown({ initialPsi: 1050, finalPsi: 690, stringStrokes: 1970, steps: 4.5 })
    ).toThrow(/whole number of steps/);
  });
});

describe('maximumAnnularPressure', () => {
  it('is what is left between the mud and the leak off', () => {
    expect(maximumAnnularPressure({ leakOffPpg: 14.5, mudPpg: 12.4, shoeTvdFeet: 6000 })).toEqual({
      psi: 655,
      alreadyOver: false,
    });
  });

  it('is nothing at all once the mud is over the leak off', () => {
    const over = maximumAnnularPressure({ leakOffPpg: 12.4, mudPpg: 12.4, shoeTvdFeet: 6000 });
    expect(over.psi).toBe(0);
    expect(over.alreadyOver).toBe(true);
  });
});

describe('influxGradient', () => {
  it('calls a light influx gas', () => {
    const influx = influxGradient({
      gainBbl: 20,
      shutInDrillPipePsi: 400,
      shutInCasingPsi: 620,
      annularCapacityBblPerFoot: 0.0459,
      mudPpg: 12.4,
    });
    expect(influx.kind).toBe('gas');
    expect(influx.heightFeet).toBe(436);
  });

  it('calls a heavy one salt water', () => {
    expect(
      influxGradient({
        gainBbl: 20,
        shutInDrillPipePsi: 400,
        shutInCasingPsi: 430,
        annularCapacityBblPerFoot: 0.0459,
        mudPpg: 12.4,
      }).kind
    ).toBe('salt water');
  });

  it('calls one in between oil', () => {
    expect(
      influxGradient({
        gainBbl: 20,
        shutInDrillPipePsi: 400,
        shutInCasingPsi: 530,
        annularCapacityBblPerFoot: 0.0459,
        mudPpg: 12.4,
      }).kind
    ).toBe('oil');
  });

  it('flags readings that do not go together rather than calling them gas', () => {
    const wrong = influxGradient({
      gainBbl: 20,
      shutInDrillPipePsi: 400,
      shutInCasingPsi: 1000,
      annularCapacityBblPerFoot: 0.0459,
      mudPpg: 12.4,
    });
    expect(wrong.impossible).toBe(true);
    expect(wrong.kind).toMatch(/do not go together/);
  });

  it('marks a sound reading as possible', () => {
    expect(
      influxGradient({
        gainBbl: 20,
        shutInDrillPipePsi: 400,
        shutInCasingPsi: 600,
        annularCapacityBblPerFoot: 0.0459,
        mudPpg: 12.4,
      }).impossible
    ).toBe(false);
  });

  it('refuses a gain of nothing', () => {
    expect(() =>
      influxGradient({
        gainBbl: 0,
        shutInDrillPipePsi: 400,
        shutInCasingPsi: 700,
        annularCapacityBblPerFoot: 0.0459,
        mudPpg: 12.4,
      })
    ).toThrow(/above zero/);
  });
});

describe('sheetChecks', () => {
  const sound = {
    currentPpg: 12.4,
    shutInDrillPipePsi: 400,
    shutInCasingPsi: 620,
    killPpg: 13.15,
    leakOffPpg: 14.5,
    influx: { impossible: false },
  };

  it('passes a sound set of readings', () => {
    expect(sheetChecks(sound).clean).toBe(true);
    expect(sheetChecks(sound).notes).toEqual([]);
  });

  it('catches the two gauges the wrong way round', () => {
    const notes = sheetChecks({ ...sound, shutInCasingPsi: 300 }).notes;
    expect(notes.join(' ')).toMatch(/wrong way round/);
  });

  it('carries the impossible influx through', () => {
    expect(sheetChecks({ ...sound, influx: { impossible: true } }).notes.join(' ')).toMatch(
      /one of the gain and the two pressures is wrong/
    );
  });

  it('catches a kill weight over the leak off', () => {
    expect(sheetChecks({ ...sound, killPpg: 15 }).notes.join(' ')).toMatch(/the shoe goes/);
  });

  it('catches a weight up that is a long way in one step', () => {
    expect(sheetChecks({ ...sound, killPpg: 15, leakOffPpg: 18 }).notes.join(' ')).toMatch(
      /a long way in one step/
    );
  });

  it('works with no leak off on file', () => {
    const without = { ...sound };
    delete without.leakOffPpg;
    expect(sheetChecks(without).clean).toBe(true);
  });
});

describe('killSheet', () => {
  const sheet = killSheet({
    currentPpg: 12.4,
    shutInDrillPipePsi: 400,
    shutInCasingPsi: 620,
    tvdFeet: 10000,
    slowPumpPsi: 650,
    stringStrokes: 1970,
    gainBbl: 20,
    annularCapacityBblPerFoot: 0.0459,
    leakOffPpg: 14.5,
    shoeTvdFeet: 6000,
  });

  it('puts the whole sheet together', () => {
    expect(sheet.killPpg).toBe(13.17);
    expect(sheet.weightUpPpg).toBe(0.77);
    expect(sheet.schedule).toHaveLength(11);
    expect(sheet.influx.kind).toBe('gas');
    expect(sheet.maximumAnnular.psi).toBe(655);
  });

  it('runs the schedule from the initial to the final pressure', () => {
    expect(sheet.schedule[0].standpipePsi).toBe(sheet.initialPsi);
    expect(sheet.schedule.at(-1).standpipePsi).toBe(sheet.finalPsi);
  });

  it('carries the cross checks on the sheet itself', () => {
    expect(sheet.checks.clean).toBe(true);
  });

  it('flags a sheet whose readings do not go together', () => {
    const wrong = killSheet({
      currentPpg: 12.4,
      shutInDrillPipePsi: 400,
      shutInCasingPsi: 1000,
      tvdFeet: 10000,
      slowPumpPsi: 650,
      stringStrokes: 1970,
      gainBbl: 20,
      annularCapacityBblPerFoot: 0.0459,
      leakOffPpg: 14.5,
      shoeTvdFeet: 6000,
    });
    expect(wrong.checks.clean).toBe(false);
    expect(wrong.influx.impossible).toBe(true);
  });
});
