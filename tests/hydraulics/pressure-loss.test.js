import { describe, it, expect } from 'vitest';
import {
  PIPE_LOSS_CONSTANT,
  ANNULAR_LOSS_CONSTANT,
  pipeLoss,
  annularLoss,
  stringLoss,
  annulusLoss,
} from '../../src/hydraulics/pressure-loss.js';

const pipeModel = { n: 0.6077, k: 1.014 };
const annularModel = { n: 0.4352, k: 2.6258 };

const string = [
  { name: 'drill pipe', idInches: 4.276, lengthFeet: 9400 },
  { name: 'drill collars', idInches: 2.8125, lengthFeet: 600 },
];

const annulus = [
  { holeName: 'casing', pipeName: 'drill pipe', idInches: 8.681, odInches: 5, lengthFeet: 6000 },
  { holeName: 'open hole', pipeName: 'drill pipe', idInches: 8.5, odInches: 5, lengthFeet: 3400 },
  { holeName: 'open hole', pipeName: 'collars', idInches: 8.5, odInches: 6.5, lengthFeet: 600 },
];

describe('pipeLoss', () => {
  const loss = pipeLoss({
    flowGpm: 600,
    idInches: 4.276,
    lengthFeet: 9400,
    densityPpg: 12.4,
    model: pipeModel,
  });

  it('uses the api form constants', () => {
    expect(PIPE_LOSS_CONSTANT).toBe(25.81);
    expect(ANNULAR_LOSS_CONSTANT).toBe(21.1);
  });

  it('reads a working drill pipe run', () => {
    expect(loss.velocityFeetPerSecond).toBe(13.4);
    expect(loss.reynolds).toBe(11623);
    expect(loss.regime).toBe('turbulent');
    expect(loss.psiPerFoot).toBe(0.10806);
    expect(loss.psi).toBe(1015.8);
  });

  it('climbs steeply with rate, because the loss goes with velocity squared', () => {
    const faster = pipeLoss({
      flowGpm: 900,
      idInches: 4.276,
      lengthFeet: 9400,
      densityPpg: 12.4,
      model: pipeModel,
    });
    expect(faster.psi / loss.psi).toBeGreaterThan(1.8);
  });

  it('climbs sharply as the bore narrows', () => {
    const tight = pipeLoss({
      flowGpm: 600,
      idInches: 2.8125,
      lengthFeet: 9400,
      densityPpg: 12.4,
      model: pipeModel,
    });
    expect(tight.psi).toBeGreaterThan(loss.psi * 5);
  });

  it('is nothing with the pump off', () => {
    const stopped = pipeLoss({
      flowGpm: 0,
      idInches: 4.276,
      lengthFeet: 9400,
      densityPpg: 12.4,
      model: pipeModel,
    });
    expect(stopped.psi).toBe(0);
    expect(stopped.reynolds).toBe(0);
  });

  it('is nothing over no length', () => {
    expect(
      pipeLoss({
        flowGpm: 600,
        idInches: 4.276,
        lengthFeet: 0,
        densityPpg: 12.4,
        model: pipeModel,
      }).psi
    ).toBe(0);
  });
});

describe('annularLoss', () => {
  const loss = annularLoss({
    flowGpm: 600,
    holeIdInches: 8.5,
    pipeOdInches: 5,
    lengthFeet: 3400,
    densityPpg: 12.4,
    model: annularModel,
  });

  it('reads a working open hole annulus', () => {
    expect(loss.velocityFeetPerMinute).toBe(311.1);
    expect(loss.reynolds).toBe(2394);
    expect(loss.regime).toBe('laminar');
    expect(loss.psi).toBe(102.6);
  });

  it('loses far more past the collars, where the gap is tight', () => {
    const collars = annularLoss({
      flowGpm: 600,
      holeIdInches: 8.5,
      pipeOdInches: 6.5,
      lengthFeet: 3400,
      densityPpg: 12.4,
      model: annularModel,
    });
    expect(collars.psiPerFoot).toBeGreaterThan(loss.psiPerFoot * 3);
  });

  it('loses less inside casing, which is wider', () => {
    const cased = annularLoss({
      flowGpm: 600,
      holeIdInches: 8.681,
      pipeOdInches: 5,
      lengthFeet: 3400,
      densityPpg: 12.4,
      model: annularModel,
    });
    expect(cased.psi).toBeLessThan(loss.psi);
  });

  it('refuses a string that does not fit', () => {
    expect(() =>
      annularLoss({
        flowGpm: 600,
        holeIdInches: 8.5,
        pipeOdInches: 8.5,
        lengthFeet: 100,
        densityPpg: 12.4,
        model: annularModel,
      })
    ).toThrow(/does not fit/);
  });
});

describe('stringLoss', () => {
  const loss = stringLoss(string, { flowGpm: 600, densityPpg: 12.4, model: pipeModel });

  it('adds every section up', () => {
    expect(loss.psi).toBe(1423.4);
    expect(loss.sections).toHaveLength(2);
  });

  it('shows the collars taking a large share of a short length', () => {
    const [pipe, collars] = loss.sections;
    expect(collars.lengthFeet / pipe.lengthFeet).toBeLessThan(0.1);
    expect(collars.psi / loss.psi).toBeGreaterThan(0.25);
  });

  it('carries the section names through', () => {
    expect(loss.sections.map((row) => row.name)).toEqual(['drill pipe', 'drill collars']);
  });
});

describe('annulusLoss', () => {
  const loss = annulusLoss(annulus, { flowGpm: 600, densityPpg: 12.4, model: annularModel });

  it('adds every length up', () => {
    expect(loss.psi).toBe(336.1);
    expect(loss.sections).toHaveLength(3);
  });

  it('is far smaller than the loss down the string', () => {
    const down = stringLoss(string, { flowGpm: 600, densityPpg: 12.4, model: pipeModel });
    expect(loss.psi).toBeLessThan(down.psi / 3);
  });

  it('carries the hole and pipe names through', () => {
    expect(loss.sections[2]).toMatchObject({ holeName: 'open hole', pipeName: 'collars' });
  });

  it('is nothing at all with no annulus', () => {
    expect(annulusLoss([], { flowGpm: 600, densityPpg: 12.4, model: annularModel }).psi).toBe(0);
  });
});
