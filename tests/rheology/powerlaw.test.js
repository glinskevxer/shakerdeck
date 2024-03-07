import { describe, it, expect } from 'vitest';
import {
  powerLawFrom,
  pipeModel,
  annularModel,
  stressAt,
  viscosityAt,
  describeIndex,
  powerLawSummary,
} from '../../src/rheology/powerlaw.js';
import { shearRate, shearStress } from '../../src/rheology/dial.js';
import { round } from '../../src/util/number.js';

const check = { 600: 64, 300: 42, 200: 33, 100: 23, 6: 6, 3: 5 };

describe('powerLawFrom', () => {
  it('fits through the pipe pair', () => {
    const model = pipeModel(check);
    expect(round(model.n, 4)).toBe(0.6077);
    expect(round(model.k, 4)).toBe(1.014);
    expect(model.throughRpm).toEqual([600, 300]);
  });

  it('fits through the annular pair, which is a different mud', () => {
    const model = annularModel(check);
    expect(round(model.n, 4)).toBe(0.4352);
    expect(round(model.k, 4)).toBe(2.6258);
  });

  it('passes through both points it was fitted to', () => {
    const model = pipeModel(check);
    expect(stressAt(model, shearRate(300))).toBeCloseTo(shearStress(42), 8);
    expect(stressAt(model, shearRate(600))).toBeCloseTo(shearStress(64), 8);
  });

  it('reads a newtonian fluid as an index of one', () => {
    const model = powerLawFrom({ 600: 60, 300: 30 }, 600, 300);
    expect(model.n).toBeCloseTo(1, 10);
  });

  it('refuses a pair in the wrong order', () => {
    expect(() => powerLawFrom(check, 300, 600)).toThrow(/not faster than/);
    expect(() => powerLawFrom(check, 300, 300)).toThrow(/not faster than/);
  });

  it('refuses to fit through a zero reading', () => {
    expect(() => powerLawFrom({ 100: 12, 3: 0 }, 100, 3)).toThrow(/at 3 rpm is zero/);
    const stuck = new Map([
      [100, 0],
      [3, 5],
    ]);
    expect(() => powerLawFrom(stuck, 100, 3)).toThrow(/at 100 rpm is zero/);
  });

  it('needs the speeds to have been read', () => {
    expect(() => annularModel({ 600: 64, 300: 42 })).toThrow(/no reading at 100 rpm/);
  });
});

describe('stressAt and viscosityAt', () => {
  const model = pipeModel(check);

  it('predicts a stress that rises with shear rate', () => {
    expect(stressAt(model, 100)).toBeLessThan(stressAt(model, 500));
    expect(round(stressAt(model, 511), 3)).toBe(44.864);
  });

  it('predicts a viscosity that falls with shear rate', () => {
    expect(viscosityAt(model, 1000)).toBeLessThan(viscosityAt(model, 100));
  });

  it('lands on the dial reading it was fitted through', () => {
    expect(round(viscosityAt(model, shearRate(300)), 1)).toBe(42);
    expect(round(viscosityAt(model, shearRate(600)), 1)).toBe(32);
  });

  it('refuses a zero shear rate, where the model runs to infinity', () => {
    expect(() => stressAt(model, 0)).toThrow(/above zero/);
    expect(() => viscosityAt(model, 0)).toThrow(/above zero/);
  });
});

describe('describeIndex', () => {
  it('puts a name to the index', () => {
    expect(describeIndex(1)).toBe('newtonian or thickening');
    expect(describeIndex(1.2)).toBe('newtonian or thickening');
    expect(describeIndex(0.85)).toBe('barely shear thinning');
    expect(describeIndex(0.61)).toBe('moderately shear thinning');
    expect(describeIndex(0.45)).toBe('strongly shear thinning');
    expect(describeIndex(0.3)).toBe('very strongly shear thinning');
  });

  it('takes each band at its lower edge', () => {
    expect(describeIndex(0.8)).toBe('barely shear thinning');
    expect(describeIndex(0.6)).toBe('moderately shear thinning');
    expect(describeIndex(0.4)).toBe('strongly shear thinning');
  });
});

describe('powerLawSummary', () => {
  it('is the rheology page of the report', () => {
    expect(powerLawSummary(check)).toEqual({
      pipeN: 0.6077,
      pipeK: 1.014,
      annularN: 0.4352,
      annularK: 2.6258,
      character: 'strongly shear thinning',
    });
  });

  it('shows the annular index below the pipe index on a treated mud', () => {
    const summary = powerLawSummary(check);
    expect(summary.annularN).toBeLessThan(summary.pipeN);
  });
});
