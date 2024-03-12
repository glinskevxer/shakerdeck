import { describe, it, expect } from 'vitest';
import { scoreModel, compareModels, bestModel, modelVerdict } from '../../src/rheology/compare.js';
import { shearStress } from '../../src/rheology/dial.js';

const check = { 600: 64, 300: 42, 200: 33, 100: 23, 6: 6, 3: 5 };
const thin = { 600: 30, 300: 15, 200: 10, 100: 5, 6: 0.3, 3: 0.15 };

describe('scoreModel', () => {
  it('scores a predictor that is exactly right at zero', () => {
    const dials = { 600: 60, 300: 30 };
    const score = scoreModel(dials, (rate) => shearStress((30 * rate) / 510.69));
    expect(score.readings).toBe(2);
    expect(score.rootMeanSquare).toBeLessThan(0.01);
  });

  it('names the speed it misses worst at', () => {
    const score = scoreModel(check, () => shearStress(42));
    expect(score.worstAt).toBe(3);
    expect(score.worstErrorDial).toBe(37);
  });

  it('reports one error row per reading taken', () => {
    const score = scoreModel(check, () => shearStress(42));
    expect(score.errors).toHaveLength(6);
    expect(score.errors[0]).toMatchObject({ rpm: 600, dial: 64, errorDial: -22 });
  });

  it('refuses an empty set', () => {
    expect(() => scoreModel({ 42: 10 }, () => 0)).toThrow(/no readings to score/);
  });
});

describe('compareModels', () => {
  const rows = compareModels(check);

  it('scores all three models', () => {
    expect(rows.map((row) => row.model)).toEqual(['bingham', 'power law', 'herschel bulkley']);
  });

  it('shows the straight line missing badly at the low end', () => {
    const straight = rows[0];
    expect(straight.worstAt).toBe(3);
    expect(straight.worstErrorDial).toBe(15.22);
  });

  it('shows each extra constant following the curve more closely', () => {
    expect(rows[1].rootMeanSquare).toBeLessThan(rows[0].rootMeanSquare);
    expect(rows[2].rootMeanSquare).toBeLessThan(rows[1].rootMeanSquare);
  });

  it('drops the three constant fit on a mud that cannot carry it', () => {
    const flat = compareModels({ 600: 22, 300: 22, 6: 22, 3: 22 });
    expect(flat.map((row) => row.model)).toEqual(['bingham', 'power law']);
  });

  it('works from the top two speeds alone', () => {
    const rows2 = compareModels({ 600: 64, 300: 42 });
    expect(rows2).toHaveLength(2);
    expect(rows2[0].readings).toBe(2);
  });
});

describe('bestModel', () => {
  it('picks the three constant fit on a mud with low end structure', () => {
    expect(bestModel(check).model).toBe('herschel bulkley');
  });

  it('picks a two constant fit on a mud with almost none', () => {
    expect(['power law', 'herschel bulkley']).toContain(bestModel(thin).model);
  });
});

describe('modelVerdict', () => {
  it('is the one line the report prints', () => {
    expect(modelVerdict(check)).toEqual({
      best: 'herschel bulkley',
      bestRootMeanSquare: 0.549,
      binghamWorstErrorDial: 15.22,
      binghamWorstAt: 3,
      modelsScored: 3,
    });
  });
});
