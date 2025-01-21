import { describe, it, expect } from 'vitest';
import {
  DEGASSER_TYPES,
  throughput,
  removalOnePass,
  steadyCut,
  degasserWorth,
  compareDegassers,
} from '../../src/solidscontrol/degasser.js';

describe('DEGASSER_TYPES', () => {
  it('takes more out on a vacuum unit than a poor boy', () => {
    expect(DEGASSER_TYPES['vacuum, large'].removes).toBeGreaterThan(
      DEGASSER_TYPES['poor boy'].removes
    );
  });

  it('lets the poor boy take a higher rate', () => {
    expect(DEGASSER_TYPES['poor boy'].capacityGpm).toBeGreaterThan(
      DEGASSER_TYPES['vacuum, large'].capacityGpm
    );
  });
});

describe('throughput', () => {
  it('keeps up when the unit is bigger than the return', () => {
    const seen = throughput({ type: 'vacuum, large', flowGpm: 600 });
    expect(seen.keepingUp).toBe(true);
    expect(seen.processedShare).toBe(1);
  });

  it('sees only part of it when it is not', () => {
    const seen = throughput({ type: 'vacuum, small', flowGpm: 600 });
    expect(seen.keepingUp).toBe(false);
    expect(seen.processedShare).toBe(0.5);
  });

  it('refuses a unit it does not know', () => {
    expect(() => throughput({ type: 'separator', flowGpm: 600 })).toThrow(
      /no degasser called separator/
    );
  });

  it('refuses a stopped pump', () => {
    expect(() => throughput({ type: 'vacuum, large', flowGpm: 0 })).toThrow(/above zero/);
  });
});

describe('removalOnePass', () => {
  it('is the removal rate when the unit keeps up', () => {
    expect(removalOnePass({ type: 'vacuum, large', flowGpm: 600 })).toBe(0.9);
  });

  it('falls with the share it sees', () => {
    expect(removalOnePass({ type: 'vacuum, small', flowGpm: 600 })).toBe(0.45);
  });
});

describe('steadyCut', () => {
  it('settles where the gas arriving matches what leaves', () => {
    const settled = steadyCut({
      type: 'vacuum, large',
      flowGpm: 600,
      gasInPerCirculationPpg: 0.18,
      uncutPpg: 12.4,
    });
    expect(settled.steadyCutPpg).toBeCloseTo(0.2, 2);
    expect(settled.cutPpg).toBeLessThan(12.4);
  });

  it('settles worse on a unit that only sees half the flow', () => {
    const good = steadyCut({
      type: 'vacuum, large',
      flowGpm: 600,
      gasInPerCirculationPpg: 0.18,
      uncutPpg: 12.4,
    });
    const poor = steadyCut({
      type: 'vacuum, small',
      flowGpm: 600,
      gasInPerCirculationPpg: 0.18,
      uncutPpg: 12.4,
    });
    expect(poor.cutPpg).toBeLessThan(good.cutPpg);
  });

  it('never lets the cut mud go to nothing', () => {
    const heavy = steadyCut({
      type: 'poor boy',
      flowGpm: 2000,
      gasInPerCirculationPpg: 3,
      uncutPpg: 12.4,
    });
    expect(heavy.cutPpg).toBeGreaterThan(0);
  });
});

describe('degasserWorth', () => {
  const worth = degasserWorth({
    type: 'vacuum, large',
    flowGpm: 600,
    gasInPerCirculationPpg: 0.18,
    uncutPpg: 12.4,
    tvdFeet: 10000,
  });

  it('puts a pressure on what the unit saves', () => {
    expect(worth.savedPsi).toBeGreaterThan(0);
    expect(worth.lossPsi).toBeLessThan(worth.withoutLossPsi);
  });

  it('shows the whole thing is worth single figures of psi', () => {
    expect(worth.withoutLossPsi).toBeLessThan(30);
  });

  it('saves more on a unit that keeps up', () => {
    const poor = degasserWorth({
      type: 'vacuum, small',
      flowGpm: 600,
      gasInPerCirculationPpg: 0.18,
      uncutPpg: 12.4,
      tvdFeet: 10000,
    });
    expect(worth.savedPsi).toBeGreaterThan(poor.savedPsi);
  });
});

describe('compareDegassers', () => {
  const rows = compareDegassers({
    flowGpm: 600,
    gasInPerCirculationPpg: 0.18,
    uncutPpg: 12.4,
    tvdFeet: 10000,
  });

  it('ranks every unit on the rig', () => {
    expect(rows).toHaveLength(Object.keys(DEGASSER_TYPES).length);
  });

  it('puts the least cut mud first', () => {
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].cutPpg).toBeLessThanOrEqual(rows[i - 1].cutPpg);
    }
  });

  it('puts the large vacuum unit at the top at this rate', () => {
    expect(rows[0].type).toBe('vacuum, large');
  });

  it('carries whether each one keeps up', () => {
    expect(rows.find((row) => row.type === 'vacuum, small').keepingUp).toBe(false);
  });
});
