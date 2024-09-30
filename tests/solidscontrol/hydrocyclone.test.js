import { describe, it, expect } from 'vitest';
import {
  CONE_TYPES,
  conesNeeded,
  bankCapacity,
  conePerformance,
  trainPerformance,
} from '../../src/solidscontrol/hydrocyclone.js';

const distribution = [
  { lowMicrons: 0, highMicrons: 20, share: 0.1 },
  { lowMicrons: 20, highMicrons: 74, share: 0.2 },
  { lowMicrons: 74, highMicrons: 150, share: 0.25 },
  { lowMicrons: 150, highMicrons: 400, share: 0.3 },
  { lowMicrons: 400, highMicrons: 2000, share: 0.15 },
];

describe('CONE_TYPES', () => {
  it('cuts finer as the cone gets smaller', () => {
    expect(CONE_TYPES.desander.cutMicrons).toBeGreaterThan(CONE_TYPES.desilter.cutMicrons);
    expect(CONE_TYPES.desander.capacityGpm).toBeGreaterThan(CONE_TYPES.desilter.capacityGpm);
  });
});

describe('conesNeeded', () => {
  it('counts the cones for a rate with headroom', () => {
    expect(conesNeeded({ type: 'desilter', flowGpm: 600 }).cones).toBe(13);
  });

  it('counts fewer of a bigger cone', () => {
    expect(conesNeeded({ type: 'desander', flowGpm: 600 }).cones).toBeLessThan(
      conesNeeded({ type: 'desilter', flowGpm: 600 }).cones
    );
  });

  it('counts fewer with no headroom asked for', () => {
    expect(conesNeeded({ type: 'desilter', flowGpm: 600, headroom: 0 }).cones).toBe(10);
  });

  it('refuses a cone it does not know', () => {
    expect(() => conesNeeded({ type: 'degasser', flowGpm: 600 })).toThrow(
      /no cone called degasser/
    );
  });
});

describe('bankCapacity', () => {
  it('sees the whole flow with enough cones', () => {
    const bank = bankCapacity({ type: 'desilter', cones: 16, flowGpm: 600 });
    expect(bank.fullyProcessing).toBe(true);
    expect(bank.processedShare).toBe(1);
    expect(bank.headroomShare).toBeGreaterThan(0);
  });

  it('sees only part of it with too few', () => {
    const bank = bankCapacity({ type: 'desilter', cones: 6, flowGpm: 600 });
    expect(bank.fullyProcessing).toBe(false);
    expect(bank.processedShare).toBe(0.6);
    expect(bank.headroomShare).toBeLessThan(0);
  });

  it('never reports more than all of it', () => {
    expect(bankCapacity({ type: 'desander', cones: 4, flowGpm: 100 }).processedShare).toBe(1);
  });
});

describe('conePerformance', () => {
  it('takes out what it cuts, over the share it sees', () => {
    const full = conePerformance({
      type: 'desilter',
      cones: 16,
      flowGpm: 600,
      distribution,
      solidsBbl: 100,
    });
    expect(full.removedBbl + full.passedBbl).toBeCloseTo(100, 1);
    expect(full.removalShare).toBeGreaterThan(0.8);
  });

  it('is worth much less when the bank is short of cones', () => {
    const full = conePerformance({
      type: 'desilter',
      cones: 16,
      flowGpm: 600,
      distribution,
      solidsBbl: 100,
    });
    const short = conePerformance({
      type: 'desilter',
      cones: 6,
      flowGpm: 600,
      distribution,
      solidsBbl: 100,
    });
    expect(short.removedBbl).toBeLessThan(full.removedBbl * 0.7);
    expect(short.fullyProcessing).toBe(false);
  });

  it('takes out less on a coarser cone', () => {
    const coarse = conePerformance({
      type: 'desander',
      cones: 3,
      flowGpm: 600,
      distribution,
      solidsBbl: 100,
    });
    const fine = conePerformance({
      type: 'desilter',
      cones: 16,
      flowGpm: 600,
      distribution,
      solidsBbl: 100,
    });
    expect(coarse.removedBbl).toBeLessThan(fine.removedBbl);
  });
});

describe('trainPerformance', () => {
  const train = trainPerformance({
    stages: [
      { type: 'desander', cones: 3, flowGpm: 600 },
      { type: 'desilter', cones: 16, flowGpm: 600 },
    ],
    distribution,
    solidsBbl: 100,
  });

  it('feeds each stage what the last one left', () => {
    expect(train.stages[1].feedBbl).toBe(train.stages[0].passedBbl);
  });

  it('feeds each stage the sizes the last one left, not the original spread', () => {
    const second = train.stages[1];
    const alone = conePerformance({
      type: 'desilter',
      cones: 16,
      flowGpm: 600,
      distribution,
      solidsBbl: second.feedBbl,
    });
    expect(second.removedBbl).toBeLessThan(alone.removedBbl);
  });

  it('removes more than either stage alone', () => {
    const desanderOnly = conePerformance({
      type: 'desander',
      cones: 3,
      flowGpm: 600,
      distribution,
      solidsBbl: 100,
    });
    expect(train.removedBbl).toBeGreaterThan(desanderOnly.removedBbl);
  });

  it('removes less than the two shares added together', () => {
    const desander = conePerformance({
      type: 'desander',
      cones: 3,
      flowGpm: 600,
      distribution,
      solidsBbl: 100,
    });
    const desilter = conePerformance({
      type: 'desilter',
      cones: 16,
      flowGpm: 600,
      distribution,
      solidsBbl: 100,
    });
    expect(train.removedBbl).toBeLessThan(desander.removedBbl + desilter.removedBbl);
  });

  it('balances over the whole train', () => {
    expect(train.removedBbl + train.passedBbl).toBeCloseTo(100, 1);
  });

  it('handles a train with nothing fed to it', () => {
    const empty = trainPerformance({
      stages: [{ type: 'desilter', cones: 16, flowGpm: 600 }],
      distribution,
      solidsBbl: 0,
    });
    expect(empty.removalShare).toBe(0);
  });
});
