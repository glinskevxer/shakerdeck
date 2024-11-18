import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CHECK_COLUMNS,
  checkRow,
  exportChecks,
  exportDays,
  exportStock,
  exportAnnulus,
  EXPORTS,
} from '../../src/report/export.js';
import { readChecks } from '../../src/mudcheck/record.js';
import { readCsv } from '../../src/util/csv.js';

const checks = readChecks(JSON.parse(readFileSync('examples/checks-brazos.json', 'utf8')));
const full = readChecks([JSON.parse(readFileSync('examples/check-brazos.json', 'utf8'))]);

describe('checkRow', () => {
  it('flattens everything the columns want', () => {
    const row = checkRow(full[0]);
    for (const column of CHECK_COLUMNS) {
      expect(Object.keys(row)).toContain(column.key);
    }
  });

  it('works the rheology and the solids out', () => {
    const row = checkRow(full[0]);
    expect(row.plasticViscosity).toBe(22);
    expect(row.drilledPercent).toBe(3.71);
    expect(row.bariteLbBbl).toBe(181.8);
  });

  it('leaves out what was not measured', () => {
    const row = checkRow(checks[0]);
    expect(row.drilledPercent).toBe(null);
    expect(row.solidsPercent).toBe(null);
  });
});

describe('exportChecks', () => {
  const csv = exportChecks(checks);

  it('writes a header and one row per check', () => {
    expect(csv.trim().split('\n')).toHaveLength(checks.length + 1);
  });

  it('names the columns the way a database wants them', () => {
    expect(csv.split('\n')[0]).toContain('weight_ppg');
    expect(csv.split('\n')[0]).not.toContain(' ');
  });

  it('reads back into the same number of records', () => {
    expect(readCsv(csv)).toHaveLength(checks.length);
  });

  it('writes a blank where a reading was not taken', () => {
    const rows = readCsv(csv);
    expect(rows[0].solids_pct).toBe('');
  });

  it('writes a header alone for no checks', () => {
    expect(exportChecks([]).trim().split('\n')).toHaveLength(1);
  });
});

describe('exportDays and exportStock', () => {
  it('writes the cost columns', () => {
    const csv = exportDays([
      { date: '2024-08-19', footageFeet: 820, total: 7418, costPerFoot: 9.05 },
    ]);
    expect(csv).toContain('cost_per_ft');
    expect(csv).toContain('7418.00');
  });

  it('writes the stock columns', () => {
    const csv = exportStock([
      { code: 'BAR', name: 'barite', unit: 'sack', openingQuantity: 200, closingQuantity: 160 },
    ]);
    expect(readCsv(csv)[0]).toEqual({
      code: 'BAR',
      product: 'barite',
      unit: 'sack',
      opening: '200.00',
      closing: '160.00',
    });
  });

  it('writes the annulus columns', () => {
    const csv = exportAnnulus([
      {
        holeName: 'open hole',
        pipeName: 'drill pipe',
        idInches: 8.5,
        odInches: 5,
        lengthFeet: 3400,
        velocityFeetPerMinute: 311.1,
        psi: 102.6,
      },
    ]);
    expect(csv).toContain('velocity_ftmin');
    expect(csv).toContain('311.1');
  });
});

describe('EXPORTS', () => {
  it('lists everything that can be written out', () => {
    expect(Object.keys(EXPORTS)).toEqual(['checks', 'days', 'stock', 'annulus']);
  });

  it('gives every entry a column set and a writer', () => {
    for (const entry of Object.values(EXPORTS)) {
      expect(Array.isArray(entry.columns)).toBe(true);
      expect(typeof entry.write).toBe('function');
    }
  });

  it('gives every column a heading with no spaces in it', () => {
    for (const entry of Object.values(EXPORTS)) {
      for (const column of entry.columns) {
        expect(column.heading).toMatch(/^[a-z0-9_]+$/);
      }
    }
  });
});
