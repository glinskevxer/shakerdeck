import { describe, it, expect } from 'vitest';
import { budgetLine, trackBudget, forecast, toFinishOnBudget } from '../../src/cost/budget.js';

const budget = { totalBudget: 120000, totalFootageFeet: 10000 };
const days = [
  { date: '2025-06-10', total: 7000, footageFeet: 600 },
  { date: '2025-06-11', total: 9000, footageFeet: 500 },
  { date: '2025-06-12', total: 8000, footageFeet: 400 },
  { date: '2025-06-13', total: 12000, footageFeet: 300 },
];

describe('budgetLine', () => {
  it('spreads the budget over the footage', () => {
    expect(budgetLine(budget).perFoot).toBe(12);
  });

  it('refuses a well with no footage in the plan', () => {
    expect(() => budgetLine({ totalBudget: 120000, totalFootageFeet: 0 })).toThrow(/above zero/);
  });
});

describe('trackBudget', () => {
  const tracked = trackBudget({ days, budget });

  it('carries the spend and the footage forward', () => {
    expect(tracked.spent).toBe(36000);
    expect(tracked.footage).toBe(1800);
  });

  it('compares each day against what the footage earned', () => {
    expect(tracked.days.at(-1).budgetedToDate).toBe(1800 * 12);
    expect(tracked.days.at(-1).varianceToDate).toBe(36000 - 21600);
  });

  it('says the well is over', () => {
    expect(tracked.over).toBe(true);
    expect(tracked.variance).toBeGreaterThan(0);
  });

  it('reports what is left of both', () => {
    expect(tracked.budgetRemaining).toBe(84000);
    expect(tracked.footageRemaining).toBe(8200);
  });

  it('says a well that is under is under', () => {
    const cheap = trackBudget({
      days: days.map((day) => ({ ...day, total: 2000 })),
      budget,
    });
    expect(cheap.over).toBe(false);
  });

  it('has no share to report on a day nothing was drilled yet', () => {
    const first = trackBudget({ days: [{ date: 'a', total: 5000, footageFeet: 0 }], budget });
    expect(first.days[0].varianceShare).toBe(null);
  });

  it('names the day whose figures are wrong', () => {
    expect(() => trackBudget({ days: [{ date: '2025-06-10', footageFeet: 600 }], budget })).toThrow(
      /2025-06-10 total/
    );
  });
});

describe('forecast', () => {
  const tracked = trackBudget({ days, budget });

  it('forecasts off the last few days rather than the whole well', () => {
    const recent = forecast({ tracked, overLastDays: 2 });
    const whole = forecast({ tracked, overLastDays: 4 });
    expect(recent.recentPerFoot).toBeGreaterThan(whole.recentPerFoot);
  });

  it('finishes over on a well that is getting dearer', () => {
    const outlook = forecast({ tracked, overLastDays: 2 });
    expect(outlook.finishesOver).toBe(true);
    expect(outlook.againstBudget).toBeGreaterThan(0);
  });

  it('uses the whole run when the window is longer than it', () => {
    expect(forecast({ tracked, overLastDays: 40 }).overDays).toBe(days.length);
  });

  it('says so when nothing was drilled over the window', () => {
    const tripping = trackBudget({
      days: [...days, { date: '2025-06-14', total: 3000, footageFeet: 0 }],
      budget,
    });
    expect(forecast({ tracked: tripping, overLastDays: 1 }).reason).toMatch(/nothing was drilled/);
  });

  it('refuses to forecast from nothing', () => {
    expect(() => forecast({ tracked: trackBudget({ days: [], budget }) })).toThrow(
      /no days to forecast/
    );
  });
});

describe('toFinishOnBudget', () => {
  it('says what the rest of the well has to come in at', () => {
    const needed = toFinishOnBudget({ tracked: trackBudget({ days, budget }) });
    expect(needed.perFoot).toBeLessThan(12);
    expect(needed.againstBudgetLine).toBeLessThan(0);
    expect(needed.possible).toBe(true);
  });

  it('says it is not possible once the budget is spent', () => {
    const spent = trackBudget({
      days: days.map((day) => ({ ...day, total: 40000 })),
      budget,
    });
    expect(toFinishOnBudget({ tracked: spent }).possible).toBe(false);
  });

  it('has nothing to say once the well is at total depth', () => {
    const finished = trackBudget({
      days: [{ date: 'a', total: 100000, footageFeet: 10000 }],
      budget,
    });
    expect(toFinishOnBudget({ tracked: finished }).reason).toMatch(/already at total depth/);
  });
});
