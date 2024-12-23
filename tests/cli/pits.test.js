import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readPits, renderPits, pitsCommand } from '../../src/cli/commands/pits.js';
import { run } from '../../src/cli/program.js';

const input = JSON.parse(readFileSync('examples/pits-brazos.json', 'utf8'));

function capture() {
  const out = [];
  const err = [];
  return {
    out,
    err,
    print: (line) => out.push(String(line)),
    fail: (line) => err.push(String(line)),
  };
}

describe('readPits', () => {
  const data = readPits(input);

  it('totals every reading', () => {
    expect(data.readings).toHaveLength(input.readings.length);
    expect(data.readings[0].activeBbl).toBeGreaterThan(0);
  });

  it('leaves the tanks that are not lined up out of the total', () => {
    const withReserve = readPits({
      ...input,
      tanks: input.tanks.map((tank) =>
        tank.name === 'reserve' ? { ...tank, active: true } : tank
      ),
    });
    expect(withReserve.readings[0].activeBbl).toBeGreaterThan(data.readings[0].activeBbl);
  });

  it('still reports the tanks that are not lined up', () => {
    expect(data.latest.tanks.map((tank) => tank.name)).toContain('reserve');
    expect(data.latest.tanks.find((tank) => tank.name === 'reserve').active).toBe(false);
  });

  it('reads the trip tank as a cylinder rather than a box', () => {
    const trip = data.latest.tanks.find((tank) => tank.name === 'trip tank');
    expect(trip.shape).toBe('horizontal cylinder');
    expect(trip.volumeBbl).toBeLessThan(6 * 20 * 3.2);
  });

  it('runs the trend across the readings', () => {
    expect(data.trend.steps).toHaveLength(input.readings.length - 1);
    expect(data.trend.netChangeBbl).toBeLessThan(0);
  });

  it('flags the step that crossed the threshold', () => {
    expect(data.trend.flagged).toBeGreaterThan(0);
  });

  it('has no trend on a single reading', () => {
    expect(readPits({ ...input, readings: [input.readings[0]] }).trend).toBe(null);
  });

  it('refuses a report with no readings', () => {
    expect(() => readPits({ ...input, readings: [] })).toThrow(/no pit readings/);
  });

  it('says which tank has no level on it', () => {
    expect(() =>
      readPits({ ...input, readings: [{ time: '00:00', levels: { suction: 6 } }] })
    ).toThrow(/no level reading for intermediate/);
  });
});

describe('renderPits', () => {
  const text = renderPits(readPits(input)).join('\n');

  it('prints each block', () => {
    expect(text).toContain('PIT REPORT');
    expect(text).toContain('TANKS AT 18:00');
    expect(text).toContain('CHANGES');
  });

  it('tables every tank at the last reading', () => {
    for (const tank of input.tanks) {
      expect(text).toContain(tank.name);
    }
  });

  it('leaves the changes out with a single reading', () => {
    const single = renderPits(readPits({ ...input, readings: [input.readings[0]] })).join('\n');
    expect(single).not.toContain('CHANGES');
  });
});

describe('the command', () => {
  it('runs from the command line', async () => {
    const io = capture();
    expect(await run(['pits', '-p', 'examples/pits-brazos.json'], io)).toBe(0);
    expect(io.out.join('\n')).toContain('PIT REPORT');
  });

  it('takes a wider threshold and flags less', async () => {
    const io = capture();
    await run(['pits', '-p', 'examples/pits-brazos.json', '--threshold', '30', '-f', 'json'], io);
    const data = JSON.parse(io.out[0]);
    expect(data.trend.flagged).toBeLessThan(readPits(input).trend.flagged);
  });

  it('returns the data and the page', () => {
    expect(pitsCommand(input).data.well).toBe('brazos 14-3');
  });
});
