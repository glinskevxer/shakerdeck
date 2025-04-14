import { describe, it, expect } from 'vitest';
import {
  dischargeRate,
  skipCover,
  trucksPerDay,
  haulageKeepsUp,
  fillsUpIn,
} from '../../src/waste/haul.js';

const rate = dischargeRate({ penetrationFeetPerHour: 60, bitDiameterInches: 8.5 });

describe('dischargeRate', () => {
  it('is the rock plus the mud on it', () => {
    const rock = ((8.5 * 8.5) / 1029.4) * 60;
    expect(rate).toBeGreaterThan(rock);
  });

  it('is nothing off bottom', () => {
    expect(dischargeRate({ penetrationFeetPerHour: 0, bitDiameterInches: 8.5 })).toBe(0);
  });

  it('grows with a bigger bit', () => {
    expect(dischargeRate({ penetrationFeetPerHour: 60, bitDiameterInches: 12.25 })).toBeGreaterThan(
      rate
    );
  });

  it('grows sharply with a wetter discharge', () => {
    expect(
      dischargeRate({ penetrationFeetPerHour: 60, bitDiameterInches: 8.5, retentionShare: 0.6 })
    ).toBeGreaterThan(rate);
  });

  it('refuses a discharge that is all liquid', () => {
    expect(() =>
      dischargeRate({ penetrationFeetPerHour: 60, bitDiameterInches: 8.5, retentionShare: 1 })
    ).toThrow(/all liquid/);
  });
});

describe('skipCover', () => {
  it('reports how long the skips will last', () => {
    const cover = skipCover({ skips: 6, skipBbl: 40, dischargeBblPerHour: rate });
    expect(cover.capacityBbl).toBe(240);
    expect(cover.hoursOfCover).toBeGreaterThan(0);
    expect(cover.full).toBe(false);
  });

  it('takes off what is already in them', () => {
    const cover = skipCover({
      skips: 6,
      skipBbl: 40,
      dischargeBblPerHour: rate,
      alreadyFullBbl: 200,
    });
    expect(cover.capacityBbl).toBe(40);
  });

  it('says so when the pad is already full', () => {
    const cover = skipCover({
      skips: 6,
      skipBbl: 40,
      dischargeBblPerHour: rate,
      alreadyFullBbl: 240,
    });
    expect(cover.full).toBe(true);
    expect(cover.hoursOfCover).toBe(0);
  });

  it('has no answer when nothing is being drilled', () => {
    expect(skipCover({ skips: 6, skipBbl: 40, dischargeBblPerHour: 0 }).hoursOfCover).toBe(null);
  });
});

describe('trucksPerDay', () => {
  it('rounds a part load up to a whole truck', () => {
    const needed = trucksPerDay({ dischargeBblPerHour: rate, skipBbl: 40 });
    expect(Number.isInteger(needed.trucksPerDay)).toBe(true);
    expect(needed.trucksPerDay).toBeGreaterThanOrEqual(needed.loadsPerDay);
  });

  it('needs fewer over a shorter drilling day', () => {
    expect(
      trucksPerDay({ dischargeBblPerHour: rate, skipBbl: 40, hoursPerDay: 12 }).loadsPerDay
    ).toBeLessThan(trucksPerDay({ dischargeBblPerHour: rate, skipBbl: 40 }).loadsPerDay);
  });

  it('needs none off bottom', () => {
    expect(trucksPerDay({ dischargeBblPerHour: 0, skipBbl: 40 }).trucksPerDay).toBe(0);
  });
});

describe('haulageKeepsUp', () => {
  it('keeps up with enough trucks and a short turnaround', () => {
    const check = haulageKeepsUp({
      dischargeBblPerHour: rate,
      skipBbl: 40,
      trucksAvailablePerDay: 3,
      turnaroundHours: 4,
    });
    expect(check.keepsUp).toBe(true);
    expect(check.runsPerTruck).toBe(6);
  });

  it('falls behind on a long turnaround', () => {
    const check = haulageKeepsUp({
      dischargeBblPerHour: rate * 4,
      skipBbl: 40,
      trucksAvailablePerDay: 1,
      turnaroundHours: 12,
    });
    expect(check.keepsUp).toBe(false);
    expect(check.shortLoadsPerDay).toBeGreaterThan(0);
  });

  it('refuses a turnaround of no time', () => {
    expect(() =>
      haulageKeepsUp({
        dischargeBblPerHour: rate,
        skipBbl: 40,
        trucksAvailablePerDay: 3,
        turnaroundHours: 0,
      })
    ).toThrow(/above zero/);
  });
});

describe('fillsUpIn', () => {
  it('never fills up when the trucks take more than the hole makes', () => {
    const filling = fillsUpIn({
      skips: 6,
      skipBbl: 40,
      alreadyFullBbl: 0,
      dischargeBblPerHour: rate,
      loadsPerDay: 12,
    });
    expect(filling.everFills).toBe(false);
    expect(filling.hours).toBe(null);
  });

  it('fills up when they do not', () => {
    const filling = fillsUpIn({
      skips: 6,
      skipBbl: 40,
      alreadyFullBbl: 0,
      dischargeBblPerHour: rate,
      loadsPerDay: 1,
    });
    expect(filling.everFills).toBe(true);
    expect(filling.hours).toBeGreaterThan(0);
  });

  it('is already full when it is already full', () => {
    expect(
      fillsUpIn({
        skips: 6,
        skipBbl: 40,
        alreadyFullBbl: 240,
        dischargeBblPerHour: rate,
        loadsPerDay: 1,
      }).hours
    ).toBe(0);
  });
});
