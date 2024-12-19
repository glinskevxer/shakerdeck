import { describe, it, expect } from 'vitest';
import {
  DISCHARGE_LIMITS,
  retentionShare,
  dischargeCompliance,
  baseFluidDischarged,
  dryingNeeded,
} from '../../src/waste/discharge.js';

const samples = [
  { label: 'shaker one', sampleGrams: 100, oilGrams: 0.8, solidsGrams: 84 },
  { label: 'shaker two', sampleGrams: 100, oilGrams: 0.9, solidsGrams: 83 },
  { label: 'dryer', sampleGrams: 100, oilGrams: 0.6, solidsGrams: 86 },
];

describe('retentionShare', () => {
  it('is the oil over the dry rock', () => {
    const held = retentionShare(samples[0]);
    expect(held.share).toBeCloseTo(0.8 / 84, 4);
    expect(held.percentOfDryWeight).toBeCloseTo(0.95, 2);
  });

  it('reports the water that made up the rest', () => {
    expect(retentionShare(samples[0]).waterGrams).toBeCloseTo(15.2, 3);
  });

  it('is nothing on a sample with no oil on it', () => {
    expect(retentionShare({ sampleGrams: 100, oilGrams: 0, solidsGrams: 90 }).share).toBe(0);
  });

  it('refuses a sample whose parts weigh more than the whole', () => {
    expect(() => retentionShare({ sampleGrams: 100, oilGrams: 30, solidsGrams: 90 })).toThrow(
      /weigh more than the sample/
    );
  });

  it('refuses a sample with no solids in it', () => {
    expect(() => retentionShare({ sampleGrams: 100, oilGrams: 1, solidsGrams: 0 })).toThrow(
      /above zero/
    );
  });
});

describe('dischargeCompliance', () => {
  it('carries the limits it knows about', () => {
    expect(DISCHARGE_LIMITS['north sea']).toBe(0.01);
    expect(DISCHARGE_LIMITS['onshore pit']).toBe(null);
  });

  it('averages over the section rather than judging one sample', () => {
    const result = dischargeCompliance({ samples });
    expect(result.averagePercent).toBeCloseTo(0.9, 1);
    expect(result.compliant).toBe(true);
  });

  it('still names the samples that were over on their own', () => {
    const result = dischargeCompliance({ samples });
    expect(result.samplesOverLimit).toBeGreaterThan(0);
    expect(result.samples.some((row) => row.overLimit)).toBe(true);
  });

  it('fails a run that is over on average', () => {
    const wet = dischargeCompliance({
      samples: samples.map((sample) => ({ ...sample, oilGrams: 2 })),
    });
    expect(wet.compliant).toBe(false);
  });

  it('passes anything where no limit applies', () => {
    const onshore = dischargeCompliance({
      samples: samples.map((sample) => ({ ...sample, oilGrams: 8 })),
      area: 'onshore pit',
    });
    expect(onshore.compliant).toBe(true);
    expect(onshore.samplesOverLimit).toBe(0);
  });

  it('refuses an area it has no limit for', () => {
    expect(() => dischargeCompliance({ samples, area: 'the moon' })).toThrow(
      /no discharge limit on file for the moon/
    );
  });

  it('refuses an empty run', () => {
    expect(() => dischargeCompliance({ samples: [] })).toThrow(/no samples to judge/);
  });
});

describe('baseFluidDischarged', () => {
  it('weighs the rock and the fluid on it', () => {
    const discharged = baseFluidDischarged({ rockBbl: 70, retentionShare: 0.01 });
    expect(discharged.dryCuttingsPounds).toBe(63700);
    expect(discharged.baseFluidPounds).toBe(637);
    expect(discharged.baseFluidBbl).toBeGreaterThan(0);
  });

  it('is nothing at all with no retention', () => {
    expect(baseFluidDischarged({ rockBbl: 70, retentionShare: 0 }).baseFluidBbl).toBe(0);
  });

  it('scales with the rock', () => {
    expect(baseFluidDischarged({ rockBbl: 140, retentionShare: 0.01 }).baseFluidPounds).toBe(
      baseFluidDischarged({ rockBbl: 70, retentionShare: 0.01 }).baseFluidPounds * 2
    );
  });
});

describe('dryingNeeded', () => {
  it('says nothing is needed inside the limit', () => {
    expect(dryingNeeded({ currentShare: 0.008 }).needed).toBe(false);
  });

  it('says how far the cuttings have to come down', () => {
    const needed = dryingNeeded({ currentShare: 0.02 });
    expect(needed.needed).toBe(true);
    expect(needed.reduceBy).toBe(0.01);
    expect(needed.shareOfCurrent).toBe(0.5);
    expect(needed.reason).toMatch(/against a limit of 1/);
  });

  it('says nothing applies where there is no limit', () => {
    expect(dryingNeeded({ currentShare: 0.2, area: 'onshore pit' }).reason).toMatch(/no limit/);
  });

  it('refuses an area it has no limit for', () => {
    expect(() => dryingNeeded({ currentShare: 0.02, area: 'the moon' })).toThrow(
      /no discharge limit/
    );
  });
});
