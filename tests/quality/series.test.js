import { describe, it, expect } from 'vitest';
import { READERS, series, chartable, movement, biggestMovers } from '../../src/quality/series.js';
import { readChecks } from '../../src/mudcheck/record.js';

const raw = [12.1, 12.2, 12.3, 12.4, 12.5, 12.6].map((weight, index) => ({
  well: 'brazos 14-3',
  date: `2024-10-0${index + 1}`,
  depthFeet: 9000 + index * 250,
  weightPpg: weight,
  funnelSeconds: 44 + index,
  dials: index % 2 === 0 ? { 600: 60 + index, 300: 38 + index } : null,
  ph: 9.5,
}));

const checks = readChecks(raw);

describe('series', () => {
  it('reads a property that is on every check', () => {
    const read = series(checks, 'weightPpg');
    expect(read.taken).toBe(6);
    expect(read.missing).toBe(0);
    expect(read.coverage).toBe(1);
  });

  it('carries the gaps rather than closing them up', () => {
    const read = series(checks, 'plasticViscosity');
    expect(read.taken).toBe(3);
    expect(read.missing).toBe(3);
    expect(read.coverage).toBe(0.5);
  });

  it('works the rheology out where the dials are there', () => {
    expect(series(checks, 'plasticViscosity').points[0].value).toBe(22);
    expect(series(checks, 'yieldPoint').points[0].value).toBe(16);
  });

  it('reads nothing at all for a property never measured', () => {
    const read = series(checks, 'chlorideMgL');
    expect(read.taken).toBe(0);
    expect(read.coverage).toBe(0);
  });

  it('carries the date and the depth with each point', () => {
    expect(series(checks, 'weightPpg').points[0]).toMatchObject({
      date: '2024-10-01',
      depthFeet: 9000,
    });
  });

  it('refuses a property that is not on a check', () => {
    expect(() => series(checks, 'temperature')).toThrow(/nothing on a check called temperature/);
  });

  it('reads an empty run without dividing by zero', () => {
    expect(series([], 'weightPpg').coverage).toBe(0);
  });
});

describe('chartable', () => {
  it('keeps a property measured often enough', () => {
    expect(chartable(checks)).toContain('weightPpg');
  });

  it('drops one measured too rarely', () => {
    expect(chartable(checks)).not.toContain('plasticViscosity');
    expect(chartable(checks)).not.toContain('chlorideMgL');
  });

  it('takes a lower bar when asked', () => {
    expect(chartable(checks, { minimumPoints: 3 })).toContain('plasticViscosity');
  });

  it('knows about ten properties', () => {
    expect(Object.keys(READERS)).toHaveLength(10);
  });
});

describe('movement', () => {
  it('reports where a property started and ended', () => {
    const moved = movement(checks, 'weightPpg');
    expect(moved.from).toBe(12.1);
    expect(moved.to).toBe(12.6);
    expect(moved.changed).toBe(0.5);
    expect(moved.overFeet).toBe(1250);
  });

  it('reports the spread as well as the change', () => {
    const moved = movement(checks, 'weightPpg');
    expect(moved.lowest).toBe(12.1);
    expect(moved.highest).toBe(12.6);
    expect(moved.spread).toBe(0.5);
  });

  it('says so when there is not enough to go on', () => {
    expect(movement(checks, 'chlorideMgL').reason).toBe('not enough readings');
    expect(movement(checks, 'chlorideMgL').movement).toBe(null);
  });
});

describe('biggestMovers', () => {
  const movers = biggestMovers(checks);

  it('ranks by how much of the spread the change accounts for', () => {
    expect(movers[0].share).toBeGreaterThanOrEqual(movers.at(-1).share);
  });

  it('leaves out a property that never moved', () => {
    expect(movers.map((row) => row.property)).not.toContain('ph');
  });

  it('leaves out a property that was never measured', () => {
    expect(movers.map((row) => row.property)).not.toContain('chlorideMgL');
  });

  it('gives a straight climb a share of one', () => {
    expect(movers.find((row) => row.property === 'weightPpg').share).toBe(1);
  });
});
