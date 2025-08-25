import { describe, it, expect } from 'vitest';
import {
  ppgToGradient,
  gradientToPpg,
  hydrostatic,
  equivalentWeight,
  pressureGradientToPpg,
} from '../src/units/density.js';
import { steadyCut, degasserWorth, compareDegassers } from '../src/solidscontrol/degasser.js';
import { compareBalances, agreesWithRetort } from '../src/mudcheck/balance.js';
import { transfer, transferForWeight } from '../src/pits/transfer.js';
import { exportDays, exportStock, exportAnnulus, checkRow } from '../src/report/export.js';
import { readCheck } from '../src/mudcheck/record.js';
import { readCsv } from '../src/util/csv.js';
import { round } from '../src/util/number.js';

describe('the exact gradient constant', () => {
  it('is used everywhere the exact flag is passed', () => {
    expect(ppgToGradient(10, { exact: true })).toBeLessThan(ppgToGradient(10));
    expect(gradientToPpg(0.52, { exact: true })).toBeGreaterThan(gradientToPpg(0.52));
    expect(hydrostatic(10, 10000, { exact: true })).toBeLessThan(hydrostatic(10, 10000));
    expect(equivalentWeight(5200, 10000, { exact: true })).toBeGreaterThan(
      equivalentWeight(5200, 10000)
    );
    expect(pressureGradientToPpg(0.465, { exact: true })).toBeGreaterThan(
      pressureGradientToPpg(0.465)
    );
  });

  it('is under a tenth of a pound different at ten thousand feet', () => {
    const drift = equivalentWeight(5200, 10000, { exact: true }) - equivalentWeight(5200, 10000);
    expect(drift).toBeLessThan(0.02);
  });
});

describe('a degasser that removes nothing', () => {
  it('never settles when the unit sees none of the flow', () => {
    const settled = steadyCut({
      type: 'vacuum, small',
      flowGpm: 600,
      gasInPerCirculationPpg: 0,
      uncutPpg: 12.4,
    });
    expect(settled.steadyCutPpg).toBe(0);
  });

  it('reports nothing to compare when the gas is nothing', () => {
    const worth = degasserWorth({
      type: 'vacuum, large',
      flowGpm: 600,
      gasInPerCirculationPpg: 0,
      uncutPpg: 12.4,
      tvdFeet: 10000,
    });
    expect(worth.savedPsi).toBe(0);
  });

  it('ranks the units even when none of them keeps up', () => {
    const rows = compareDegassers({
      flowGpm: 4000,
      gasInPerCirculationPpg: 0.18,
      uncutPpg: 12.4,
      tvdFeet: 10000,
    });
    expect(rows.every((row) => row.keepingUp === false)).toBe(true);
  });
});

describe('a balance comparison with no mud reading on it', () => {
  it('reads the water readings alone', () => {
    const comparison = compareBalances({
      readings: [{ waterReadingPpg: 8.35 }, { waterReadingPpg: 8.4 }],
    });
    expect(comparison.balances[0].label).toBe('balance 1');
    expect(comparison.balances[0].mudReadingPpg).toBe(null);
  });

  it('agrees with a retort on a mud with no oil in it at all', () => {
    expect(agreesWithRetort({ weightPpg: 8.9, solidsPercent: 3, waterPercent: 97 }).agrees).toBe(
      true
    );
  });
});

describe('a transfer with no names on the pits', () => {
  it('falls back to from and to', () => {
    const moved = transfer({
      from: { volumeBbl: 300, weightPpg: 15 },
      to: { volumeBbl: 700, weightPpg: 12 },
      volumeBbl: 100,
    });
    expect(moved.from.name).toBe('from');
    expect(moved.to.name).toBe('to');
  });

  it('says the pit only holds what it holds, with no name to use', () => {
    expect(() =>
      transfer({
        from: { volumeBbl: 10, weightPpg: 15 },
        to: { volumeBbl: 700, weightPpg: 12 },
        volumeBbl: 100,
      })
    ).toThrow(/the pit only holds 10 barrels/);
  });

  it('moves nothing when the target is where the pit already is', () => {
    const needed = transferForWeight({
      from: { volumeBbl: 300, weightPpg: 15 },
      to: { volumeBbl: 700, weightPpg: 12 },
      targetPpg: 12,
    });
    expect(needed.volumeBbl).toBe(0);
  });
});

describe('exports with values that are not there', () => {
  it('writes a blank for a day with no cost per foot', () => {
    const rows = readCsv(exportDays([{ date: '2025-06-02', footageFeet: 0, total: 1450 }]));
    expect(rows[0].cost_per_ft).toBe('');
  });

  it('writes a blank for a stock line with no opening', () => {
    const rows = readCsv(exportStock([{ code: 'BAR', name: 'barite', unit: 'sack' }]));
    expect(rows[0].opening).toBe('');
  });

  it('writes an annulus row with no loss worked out yet', () => {
    const rows = readCsv(
      exportAnnulus([{ holeName: 'open hole', pipeName: 'drill pipe', idInches: 8.5, odInches: 5 }])
    );
    expect(rows[0].loss_psi).toBe('');
  });

  it('flattens a check with a retort but no clay reading', () => {
    const row = checkRow(
      readCheck({
        well: 'x',
        date: '2025-06-02',
        depthFeet: 9000,
        weightPpg: 12.4,
        retort: { solidsPercent: 18, oilPercent: 0, waterPercent: 82 },
      })
    );
    expect(row.drilledPercent).toBeGreaterThan(0);
    expect(row.plasticViscosity).toBe(null);
  });

  it('rounds a value that lands exactly between two cells', () => {
    expect(round(0.125, 2)).toBe(0.13);
  });
});

describe('the paths the ordinary run does not reach', () => {
  it('renders a handover with no movers and a settled chart', async () => {
    const { buildHandover, renderHandover } = await import('../src/report/handover.js');
    const { readChecks } = await import('../src/mudcheck/record.js');
    const flat = readChecks([
      { well: 'x', date: '2025-08-20', depthFeet: 9000, weightPpg: 12.4 },
      { well: 'x', date: '2025-08-21', depthFeet: 9000, weightPpg: 12.4 },
    ]);
    const text = renderHandover(
      buildHandover({ well: 'x', outgoing: 'a', incoming: 'b', date: '2025-08-21', checks: flat })
    ).join('\n');
    expect(text).toContain('nothing moved worth mentioning');
  });

  it('renders a handover with everything on it at once', async () => {
    const { buildHandover, renderHandover } = await import('../src/report/handover.js');
    const { readChecks } = await import('../src/mudcheck/record.js');
    const climbing = readChecks(
      Array.from({ length: 8 }, (_, index) => ({
        well: 'x',
        date: `2025-08-1${index}`,
        depthFeet: 9000 + index * 100,
        weightPpg: 12 + index * 0.1,
      }))
    );
    const text = renderHandover(
      buildHandover({
        well: 'x',
        outgoing: 'a',
        incoming: 'b',
        date: '2025-08-21',
        checks: climbing,
        stock: [{ name: 'barite', short: true, daysOfCover: 1.2 }],
        treatments: [{ date: '2025-08-20', what: 'lime', responded: false }],
        openItems: ['the number two pump'],
      })
    ).join('\n');
    expect(text).toContain('SHORT');
    expect(text).toContain('TREATED AND NOT ANSWERED YET');
    expect(text).toContain('OPEN');
  });

  it('finds a degasser that removes nothing at all', async () => {
    const { steadyCut } = await import('../src/solidscontrol/degasser.js');
    const settled = steadyCut({
      type: 'poor boy',
      flowGpm: 100000,
      gasInPerCirculationPpg: 0.2,
      uncutPpg: 12.4,
    });
    expect(settled.neverSettles).toBe(false);
  });

  it('reads a programme with a section that has no windows at all', async () => {
    const { programmeCommand } = await import('../src/cli/commands/programme.js');
    const result = programmeCommand({
      programme: { well: 'x', sections: [{ name: 'riserless', fromFeet: 0, toFeet: 500 }] },
    });
    expect(result.lines.join('\n')).toContain('RISERLESS');
  });

  it('reads a check with gels but no dials on it', async () => {
    const { readCheckSheet } = await import('../src/cli/commands/check.js');
    const sheet = readCheckSheet({
      well: 'x',
      date: '2025-08-21',
      depthFeet: 9000,
      weightPpg: 12.4,
      gels: { tenSecond: 6, tenMinute: 9 },
    });
    expect(sheet.rheology).toBe(null);
    expect(sheet.gels.tenMinute).toBe(9);
  });

  it('reads a survey station at the very first depth', async () => {
    const { runSurvey, tvdAt } = await import('../src/well/survey.js');
    const survey = runSurvey([
      { measuredDepthFeet: 0.001, inclinationDegrees: 0 },
      { measuredDepthFeet: 1000, inclinationDegrees: 0 },
    ]);
    expect(tvdAt(survey, 0)).toBe(0);
  });

  it('orders against a product with no history and no use', async () => {
    const { reorderReport } = await import('../src/inventory/reorder.js');
    const rows = reorderReport({
      stock: [{ code: 'X', name: 'x', unit: 'sack', closingQuantity: 0 }],
      history: { X: [] },
      leadTimeDays: 3,
      coverDays: 14,
    });
    expect(rows[0].daysOfCover).toBe(null);
  });
});
