import { describe, it, expect } from 'vitest';
import { standVolume, runTripSheet, driftOnset } from '../../src/well/tripsheet.js';

const pipe = {
  standFeet: 93,
  displacementBblPerFoot: 0.00652,
  capacityBblPerFoot: 0.01776,
};

function stands(count, movedBbl) {
  return Array.from({ length: count }, (_, index) => ({
    movedBbl,
    depthFeet: 10450 - index * 93,
  }));
}

describe('standVolume', () => {
  it('takes the steel and the bore pulling wet', () => {
    expect(standVolume(pipe)).toBe(2.258);
  });

  it('takes only the steel pulling dry', () => {
    expect(standVolume({ ...pipe, wet: false })).toBe(0.606);
  });

  it('refuses a stand of no length', () => {
    expect(() => standVolume({ ...pipe, standFeet: 0 })).toThrow(/above zero/);
  });
});

describe('runTripSheet', () => {
  it('is on paper when every stand matches', () => {
    const sheet = runTripSheet({ ...pipe, readings: stands(20, standVolume(pipe)) });
    expect(sheet.verdict).toBe('on paper');
    expect(sheet.investigate).toBe(false);
    expect(sheet.differenceBbl).toBe(0);
  });

  it('carries a running total that no single stand shows', () => {
    const sheet = runTripSheet({ ...pipe, readings: stands(20, 1.959) });
    expect(Math.abs(sheet.stands[0].differenceBbl)).toBeLessThan(1);
    expect(Math.abs(sheet.differenceBbl)).toBeGreaterThan(5);
  });

  it('warns that a hole taking less may be swabbing in', () => {
    const sheet = runTripSheet({ ...pipe, readings: stands(20, 1.959) });
    expect(sheet.verdict).toMatch(/swabbing in/);
  });

  it('warns that a hole taking more may be losing', () => {
    const sheet = runTripSheet({ ...pipe, readings: stands(20, 2.6) });
    expect(sheet.verdict).toMatch(/losing/);
  });

  it('reads the other direction going back in', () => {
    const flowing = runTripSheet({ ...pipe, direction: 'in', readings: stands(20, 2.6) });
    expect(flowing.verdict).toMatch(/flowing/);
    const losing = runTripSheet({ ...pipe, direction: 'in', readings: stands(20, 1.959) });
    expect(losing.verdict).toMatch(/losing/);
  });

  it('names the stand the difference first crossed the threshold on', () => {
    const sheet = runTripSheet({ ...pipe, readings: stands(20, 1.959) });
    expect(sheet.firstFlaggedStand).toBeGreaterThan(1);
    expect(sheet.firstFlaggedStand).toBeLessThan(20);
  });

  it('flags nothing when nothing drifted', () => {
    expect(
      runTripSheet({ ...pipe, readings: stands(20, standVolume(pipe)) }).firstFlaggedStand
    ).toBe(null);
  });

  it('carries the depth of each stand', () => {
    expect(
      runTripSheet({ ...pipe, readings: stands(3, standVolume(pipe)) }).stands[0].depthFeet
    ).toBe(10450);
  });

  it('takes a tighter threshold', () => {
    const tight = runTripSheet({ ...pipe, readings: stands(20, 2.159), thresholdBbl: 1 });
    expect(tight.investigate).toBe(true);
  });

  it('refuses a direction that is not a trip', () => {
    expect(() => runTripSheet({ ...pipe, direction: 'sideways', readings: stands(2, 2) })).toThrow(
      /goes in or out/
    );
  });

  it('refuses an empty sheet', () => {
    expect(() => runTripSheet({ ...pipe, readings: [] })).toThrow(/no trip tank readings/);
  });

  it('names the stand whose reading is wrong', () => {
    expect(() =>
      runTripSheet({ ...pipe, readings: [{ movedBbl: 2.2 }, { movedBbl: 'wet' }] })
    ).toThrow(/stand 2 movedBbl/);
  });
});

describe('driftOnset', () => {
  it('finds where a slow drift became worth acting on', () => {
    const onset = driftOnset(runTripSheet({ ...pipe, readings: stands(20, 1.959) }));
    expect(onset.stand).toBeGreaterThan(1);
    expect(onset.depthFeet).toBeLessThan(10450);
  });

  it('shows that no single stand was far out', () => {
    const onset = driftOnset(runTripSheet({ ...pipe, readings: stands(20, 1.959) }));
    expect(onset.worstSingleStandBbl).toBeLessThan(1);
  });

  it('finds nothing on a clean sheet', () => {
    expect(driftOnset(runTripSheet({ ...pipe, readings: stands(20, standVolume(pipe)) }))).toBe(
      null
    );
  });
});
