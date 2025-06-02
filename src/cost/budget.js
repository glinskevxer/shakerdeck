/**
 * Spending against a budget, day by day.
 *
 * The estimate is agreed before spud and then nobody looks at it again until
 * the well is over. This tracks the spend against it as the well goes, so the
 * conversation about an overrun happens while there is still something that
 * can be done about it.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';

/**
 * The budget spread over the footage, which is the only fair way to compare a
 * day against it.
 */
export function budgetLine({ totalBudget, totalFootageFeet }) {
  const budget = toPositive(totalBudget, 'totalBudget');
  const footage = toPositive(totalFootageFeet, 'totalFootageFeet');
  return {
    perFoot: round(budget / footage, 4),
    totalBudget: round(budget, 2),
    totalFootageFeet: footage,
  };
}

/**
 * Track a run of days against the line.
 */
export function trackBudget({ days, budget }) {
  const line = budgetLine(budget);
  let spent = 0;
  let drilled = 0;
  const rows = days.map((day) => {
    spent += toNonNegative(day.total, `${day.date} total`);
    drilled += toNonNegative(day.footageFeet, `${day.date} footageFeet`);
    const earned = drilled * line.perFoot;
    return {
      date: day.date,
      spentToDate: round(spent, 2),
      footageToDate: drilled,
      budgetedToDate: round(earned, 2),
      varianceToDate: round(spent - earned, 2),
      varianceShare: earned === 0 ? null : round((spent - earned) / earned, 3),
    };
  });
  const last = rows.at(-1) ?? null;
  return {
    line,
    days: rows,
    spent: round(spent, 2),
    footage: drilled,
    budgetRemaining: round(line.totalBudget - spent, 2),
    footageRemaining: round(line.totalFootageFeet - drilled, 1),
    variance: last ? last.varianceToDate : 0,
    over: last ? last.varianceToDate > 0 : false,
  };
}

/**
 * Where the well finishes if the last few days are what the rest looks like.
 *
 * A forecast off the whole well to date is dominated by the surface hole,
 * which was cheap and fast and is not what the rest of the well will be.
 */
export function forecast({ tracked, overLastDays = 5 }) {
  const rows = tracked.days;
  if (rows.length === 0) {
    throw new Error('there are no days to forecast from');
  }
  const size = Math.min(Math.max(1, Math.trunc(overLastDays)), rows.length);
  const before = rows[rows.length - size - 1] ?? { spentToDate: 0, footageToDate: 0 };
  const last = rows.at(-1);
  const spentInWindow = last.spentToDate - before.spentToDate;
  const footageInWindow = last.footageToDate - before.footageToDate;
  if (footageInWindow <= 0) {
    return { perFoot: null, finalCost: null, reason: 'nothing was drilled over the window' };
  }
  const perFoot = spentInWindow / footageInWindow;
  const finish = tracked.spent + perFoot * tracked.footageRemaining;
  return {
    overDays: size,
    recentPerFoot: round(perFoot, 2),
    budgetPerFoot: tracked.line.perFoot,
    finalCost: round(finish, 2),
    againstBudget: round(finish - tracked.line.totalBudget, 2),
    finishesOver: finish > tracked.line.totalBudget,
    spentInWindow: round(spentInWindow, 2),
    reason: null,
  };
}

/**
 * What would have to change to finish on budget.
 */
export function toFinishOnBudget({ tracked }) {
  if (tracked.footageRemaining <= 0) {
    return { perFoot: null, reason: 'the well is already at total depth' };
  }
  const allowed = tracked.budgetRemaining / tracked.footageRemaining;
  return {
    perFoot: round(allowed, 2),
    againstBudgetLine: round(allowed - tracked.line.perFoot, 2),
    possible: allowed > 0,
    reason: null,
  };
}
