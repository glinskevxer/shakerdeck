import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MARGINS,
  weightForDepth,
  deepestOnThisShoe,
  planSeats,
  windowAt,
} from '../../src/program/casing-plan.js';

const profile = [
  { depthFeet: 2000, porePressurePpg: 8.7, fractureGradientPpg: 12.5 },
  { depthFeet: 4000, porePressurePpg: 8.9, fractureGradientPpg: 13.5 },
  { depthFeet: 6000, porePressurePpg: 9.4, fractureGradientPpg: 14.5 },
  { depthFeet: 8000, porePressurePpg: 11.2, fractureGradientPpg: 15.5 },
  { depthFeet: 10000, porePressurePpg: 12.6, fractureGradientPpg: 16.5 },
  { depthFeet: 12000, porePressurePpg: 14.4, fractureGradientPpg: 17.5 },
];

describe('weightForDepth', () => {
  it('puts the trip margin on the pore pressure', () => {
    expect(DEFAULT_MARGINS.trip).toBe(0.5);
    expect(weightForDepth({ porePressurePpg: 12.6 })).toBe(13.1);
  });

  it('takes a different margin', () => {
    expect(weightForDepth({ porePressurePpg: 12.6, tripMargin: 0.2 })).toBe(12.8);
  });
});

describe('deepestOnThisShoe', () => {
  it('goes as deep as the shoe allows', () => {
    const reach = deepestOnThisShoe({ profile, shoeFractureGradientPpg: 12.5 });
    expect(reach.depthFeet).toBeGreaterThan(2000);
    expect(reach.stoppedBy).toBeGreaterThan(reach.depthFeet);
  });

  it('reaches the bottom on a shoe that takes anything', () => {
    const reach = deepestOnThisShoe({ profile, shoeFractureGradientPpg: 20 });
    expect(reach.depthFeet).toBe(12000);
    expect(reach.stoppedBy).toBe(null);
  });

  it('reaches nothing at all on a shoe that takes nothing', () => {
    const reach = deepestOnThisShoe({ profile, shoeFractureGradientPpg: 9 });
    expect(reach.depthFeet).toBe(null);
    expect(reach.stoppedBy).toBe(2000);
  });

  it('carries the weight that stopped it and what the shoe takes', () => {
    const reach = deepestOnThisShoe({ profile, shoeFractureGradientPpg: 12.5 });
    expect(reach.neededPpg).toBeGreaterThan(0);
    expect(reach.shoeTakesPpg).toBe(12.5);
  });
});

describe('planSeats', () => {
  const plan = planSeats({ profile, surfaceFractureGradientPpg: 12.5 });

  it('works the seats down the well', () => {
    expect(plan.strings).toBeGreaterThan(1);
    expect(plan.seats[0].fromFeet).toBe(0);
  });

  it('joins each seat to the next', () => {
    for (let i = 1; i < plan.seats.length; i += 1) {
      expect(plan.seats[i].fromFeet).toBe(plan.seats[i - 1].toFeet);
    }
  });

  it('reaches total depth on this profile', () => {
    expect(plan.reachesTotalDepth).toBe(true);
    expect(plan.seats.at(-1).toFeet).toBe(12000);
  });

  it('needs fewer strings on a stronger formation', () => {
    const strong = planSeats({
      profile: profile.map((point) => ({ ...point, fractureGradientPpg: 20 })),
      surfaceFractureGradientPpg: 20,
    });
    expect(strong.strings).toBeLessThanOrEqual(plan.strings);
  });

  it('says so when the top of the well cannot be drilled at all', () => {
    const impossible = planSeats({ profile, surfaceFractureGradientPpg: 9 });
    expect(impossible.seats[0].impossible).toBe(true);
    expect(impossible.reachesTotalDepth).toBe(false);
  });

  it('refuses a plan with no profile', () => {
    expect(() => planSeats({ profile: [], surfaceFractureGradientPpg: 12.5 })).toThrow(
      /needs a pressure profile/
    );
  });
});

describe('windowAt', () => {
  it('reports the floor, the ceiling and the width', () => {
    const window = windowAt({ point: profile[4] });
    expect(window.floorPpg).toBe(13.1);
    expect(window.ceilingPpg).toBe(16.5);
    expect(window.widthPpg).toBe(3.4);
    expect(window.workable).toBe(true);
  });

  it('says a window is not workable when it closes', () => {
    const closed = windowAt({
      point: { depthFeet: 14000, porePressurePpg: 17, fractureGradientPpg: 17.2 },
    });
    expect(closed.workable).toBe(false);
    expect(closed.widthPpg).toBeLessThan(0);
  });
});
