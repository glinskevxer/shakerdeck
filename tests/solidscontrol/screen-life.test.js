import { describe, it, expect } from 'vitest';
import {
  EXPECTED_HOURS,
  screenLife,
  lifeByScreen,
  screenCost,
  screenVerdict,
  screenReview,
} from '../../src/solidscontrol/screen-life.js';

const runs = [
  { api: 170, onHours: 0, offHours: 42 },
  { api: 170, onHours: 42, offHours: 78 },
  { api: 200, onHours: 0, offHours: 14, reason: 'torn' },
  { api: 200, onHours: 14, offHours: 22, reason: 'torn' },
  { api: 200, onHours: 22, offHours: 40 },
];

describe('screenLife', () => {
  it('is the hours between going on and coming off', () => {
    expect(screenLife({ api: 170, onHours: 0, offHours: 42 }).hours).toBe(42);
  });

  it('defaults the reason to worn', () => {
    expect(screenLife({ api: 170, onHours: 0, offHours: 42 }).reason).toBe('worn');
  });

  it('refuses a screen that came off before it went on', () => {
    expect(() => screenLife({ api: 170, onHours: 40, offHours: 20 })).toThrow(
      /cannot come off at 20 hours/
    );
  });
});

describe('lifeByScreen', () => {
  const rows = lifeByScreen(runs);

  it('groups by designation', () => {
    expect(rows.map((row) => row.api).sort()).toEqual([170, 200]);
  });

  it('puts the shortest lived first', () => {
    expect(rows[0].api).toBe(200);
  });

  it('averages the life of each', () => {
    expect(rows.find((row) => row.api === 170).averageHours).toBe(39);
  });

  it('counts the ones that tore', () => {
    expect(rows.find((row) => row.api === 200).torn).toBe(2);
    expect(rows.find((row) => row.api === 170).torn).toBe(0);
  });

  it('refuses an empty book', () => {
    expect(() => lifeByScreen([])).toThrow(/no screen runs/);
  });
});

describe('screenCost', () => {
  it('counts the screens and the time off line', () => {
    const cost = screenCost({ runs, pricePerScreen: 180, rigRatePerHour: 1200 });
    expect(cost.screens).toBe(5);
    expect(cost.screenCost).toBe(900);
    expect(cost.offLineHours).toBeCloseTo(1.67, 2);
    expect(cost.totalCost).toBeGreaterThan(cost.screenCost);
  });

  it('costs nothing off line when the rig rate is not counted', () => {
    expect(screenCost({ runs, pricePerScreen: 180 }).offLineCost).toBe(0);
  });

  it('takes a longer change out', () => {
    expect(
      screenCost({ runs, pricePerScreen: 180, changeMinutes: 45, rigRatePerHour: 1200 })
        .offLineHours
    ).toBeGreaterThan(screenCost({ runs, pricePerScreen: 180 }).offLineHours);
  });
});

describe('screenVerdict', () => {
  it('expects less from a finer screen', () => {
    expect(EXPECTED_HOURS.coarse).toBeGreaterThan(EXPECTED_HOURS.fine);
    expect(screenVerdict({ api: 60, hours: 90 }).band).toBe('coarse');
    expect(screenVerdict({ api: 140, hours: 40 }).band).toBe('medium');
    expect(screenVerdict({ api: 230, hours: 20 }).band).toBe('fine');
  });

  it('calls a life close to the expectation as expected', () => {
    expect(screenVerdict({ api: 170, hours: 42 }).level).toBe('as expected');
  });

  it('calls a short life short', () => {
    expect(screenVerdict({ api: 170, hours: 24 }).level).toBe('short');
    expect(screenVerdict({ api: 170, hours: 8 }).level).toBe('far short');
  });

  it('calls a long one better than expected', () => {
    expect(screenVerdict({ api: 170, hours: 120 }).level).toBe('better than expected');
  });
});

describe('screenReview', () => {
  const review = screenReview(runs);

  it('counts the short lived screens', () => {
    expect(review.shortLived).toBeGreaterThan(0);
  });

  it('reports the share that tore', () => {
    expect(review.tornShare).toBe(0.4);
  });

  it('does not blame the shaker when most of them wore out', () => {
    expect(review.likelyShaker).toBe(false);
  });

  it('blames the shaker when most of them tore', () => {
    const tearing = screenReview(runs.map((run) => ({ ...run, reason: 'torn' })));
    expect(tearing.likelyShaker).toBe(true);
    expect(tearing.tornShare).toBe(1);
  });
});
