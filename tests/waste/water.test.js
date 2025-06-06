import { describe, it, expect } from 'vitest';
import {
  mudWaterUse,
  waterCover,
  waterToOrder,
  wasteWater,
  waterBalance,
} from '../../src/waste/water.js';

describe('mudWaterUse', () => {
  it('counts the water in new mud, the dilution and the washing', () => {
    const use = mudWaterUse({
      mudBuiltBbl: 180,
      waterFraction: 0.82,
      dilutionBbl: 120,
      washingBbl: 40,
    });
    expect(use.inNewMudBbl).toBeCloseTo(147.6, 1);
    expect(use.totalBbl).toBeCloseTo(307.6, 1);
  });

  it('counts only the water in the mud when nothing else was used', () => {
    expect(mudWaterUse({ mudBuiltBbl: 180, waterFraction: 0.82 }).totalBbl).toBeCloseTo(147.6, 1);
  });

  it('is nothing on a day nothing was built', () => {
    expect(mudWaterUse({ mudBuiltBbl: 0, waterFraction: 0.82 }).totalBbl).toBe(0);
  });

  it('refuses a water fraction over one', () => {
    expect(() => mudWaterUse({ mudBuiltBbl: 180, waterFraction: 82 })).toThrow(
      /more than all of the mud/
    );
  });
});

describe('waterCover', () => {
  it('reports the days of cover', () => {
    const cover = waterCover({ onLocationBbl: 1200, usePerDayBbl: 300, rigUsePerDayBbl: 100 });
    expect(cover.daysOfCover).toBe(3);
    expect(cover.mudShare).toBe(0.75);
  });

  it('has no answer when nothing is being used', () => {
    expect(waterCover({ onLocationBbl: 1200, usePerDayBbl: 0 }).daysOfCover).toBe(null);
  });

  it('is nothing when the tanks are empty', () => {
    expect(waterCover({ onLocationBbl: 0, usePerDayBbl: 300 }).daysOfCover).toBe(0);
  });
});

describe('waterToOrder', () => {
  it('orders enough to reach the cover', () => {
    const order = waterToOrder({
      onLocationBbl: 400,
      usePerDayBbl: 300,
      coverDays: 4,
      tankBbl: 120,
    });
    expect(order.shortBbl).toBe(800);
    expect(order.loads).toBe(7);
  });

  it('orders nothing when there is already enough', () => {
    const order = waterToOrder({
      onLocationBbl: 2000,
      usePerDayBbl: 300,
      coverDays: 4,
      tankBbl: 120,
    });
    expect(order.shortBbl).toBe(0);
    expect(order.loads).toBe(0);
  });

  it('rounds a part load up to a whole truck', () => {
    const order = waterToOrder({
      onLocationBbl: 0,
      usePerDayBbl: 100,
      coverDays: 1,
      tankBbl: 120,
    });
    expect(order.loads).toBe(1);
  });
});

describe('wasteWater', () => {
  it('adds the rain and takes the evaporation off', () => {
    const waste = wasteWater({
      dischargeBbl: 400,
      rainfallBbl: 90,
      evaporationBbl: 30,
      tankBbl: 120,
    });
    expect(waste.netBbl).toBe(460);
    expect(waste.loads).toBe(4);
    expect(waste.rainAdded).toBe(true);
  });

  it('never goes below nothing on a dry hot week', () => {
    expect(wasteWater({ dischargeBbl: 20, evaporationBbl: 90, tankBbl: 120 }).netBbl).toBe(0);
  });

  it('says when no rain was recorded', () => {
    expect(wasteWater({ dischargeBbl: 400, tankBbl: 120 }).rainAdded).toBe(false);
  });
});

describe('waterBalance', () => {
  it('balances when everything is accounted for', () => {
    const balance = waterBalance({
      broughtInBbl: 4000,
      usedBbl: 2600,
      dischargedBbl: 900,
      heldBbl: 500,
    });
    expect(balance.unaccountedBbl).toBe(0);
    expect(balance.balances).toBe(true);
  });

  it('allows a small difference, because tanks are read off a stick', () => {
    expect(
      waterBalance({ broughtInBbl: 4000, usedBbl: 2600, dischargedBbl: 900, heldBbl: 460 }).balances
    ).toBe(true);
  });

  it('does not balance when a lot is missing', () => {
    const balance = waterBalance({
      broughtInBbl: 4000,
      usedBbl: 1600,
      dischargedBbl: 400,
      heldBbl: 500,
    });
    expect(balance.balances).toBe(false);
    expect(balance.unaccountedBbl).toBe(1500);
  });
});
