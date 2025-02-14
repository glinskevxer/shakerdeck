import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readTrip, renderTrip, tripCommand } from '../../src/cli/commands/trip.js';
import { run } from '../../src/cli/program.js';

const input = JSON.parse(readFileSync('examples/trip-brazos.json', 'utf8'));

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

describe('readTrip', () => {
  const data = readTrip(input);

  it('runs every stand on the sheet', () => {
    expect(data.stands).toHaveLength(input.readings.length);
  });

  it('finds the hole taking less than it should', () => {
    expect(data.differenceBbl).toBeLessThan(0);
    expect(data.verdict).toMatch(/swabbing in/);
  });

  it('finds where the drift crossed the threshold', () => {
    expect(data.drift.stand).toBeGreaterThan(1);
    expect(data.drift.depthFeet).toBeLessThan(10450);
  });

  it('shows no single stand was far out', () => {
    expect(data.drift.worstSingleStandBbl).toBeLessThan(1);
    expect(Math.abs(data.differenceBbl)).toBeGreaterThan(data.drift.worstSingleStandBbl * 10);
  });

  it('finds nothing on a clean sheet', () => {
    const clean = readTrip({
      ...input,
      readings: input.readings.map((reading) => ({ ...reading, movedBbl: 2.258 })),
    });
    expect(clean.drift).toBe(null);
    expect(clean.verdict).toBe('on paper');
  });

  it('reads the other direction', () => {
    const going = readTrip({ ...input, direction: 'in' });
    expect(going.direction).toBe('in');
    expect(going.verdict).toMatch(/losing/);
  });
});

describe('renderTrip', () => {
  const text = renderTrip(readTrip(input)).join('\n');

  it('prints each block', () => {
    expect(text).toContain('TRIP SHEET');
    expect(text).toContain('STAND BY STAND');
    expect(text).toContain('VERDICT');
  });

  it('says why the running total is the one to read', () => {
    expect(text).toContain('the running total is the one to read');
  });

  it('leaves that out on a clean sheet', () => {
    const clean = renderTrip(
      readTrip({
        ...input,
        readings: input.readings.map((reading) => ({ ...reading, movedBbl: 2.258 })),
      })
    ).join('\n');
    expect(clean).not.toContain('the running total is the one to read');
  });
});

describe('the command', () => {
  it('runs from the command line', async () => {
    const io = capture();
    expect(await run(['trip', '-t', 'examples/trip-brazos.json'], io)).toBe(0);
    expect(io.out.join('\n')).toContain('TRIP SHEET');
  });

  it('takes a tighter threshold', async () => {
    const io = capture();
    await run(['trip', '-t', 'examples/trip-brazos.json', '--threshold', '1', '-f', 'json'], io);
    const data = JSON.parse(io.out[0]);
    expect(data.firstFlaggedStand).toBeLessThan(readTrip(input).firstFlaggedStand);
  });

  it('returns the data and the page', () => {
    expect(tripCommand(input).data.well).toBe('brazos 14-3');
  });
});
