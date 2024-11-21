import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildExport, exportCommand } from '../../src/cli/commands/export.js';
import { readCsv } from '../../src/util/csv.js';
import { run } from '../../src/cli/program.js';

const checks = JSON.parse(readFileSync('examples/checks-brazos.json', 'utf8'));
const days = JSON.parse(readFileSync('examples/days-brazos.json', 'utf8'));
const movements = JSON.parse(readFileSync('examples/movements.json', 'utf8'));
const products = JSON.parse(readFileSync('examples/products.json', 'utf8'));
const opening = JSON.parse(readFileSync('examples/opening-stock.json', 'utf8'));

function capture() {
  const out = [];
  const err = [];
  return {
    out,
    err,
    print: (line) => out.push(String(line)),
    fail: (line) => err.push(String(line)),
  };
}

describe('buildExport', () => {
  it('writes the checks', () => {
    const rows = readCsv(buildExport({ table: 'checks', input: checks }));
    expect(rows).toHaveLength(checks.length);
    expect(rows[0].weight_ppg).toBe('12.10');
  });

  it('writes the days once they are valued', () => {
    const rows = readCsv(buildExport({ table: 'days', input: days, products }));
    expect(rows).toHaveLength(days.length);
    expect(Number(rows[0].day_total)).toBeGreaterThan(0);
  });

  it('writes the stock', () => {
    const rows = readCsv(buildExport({ table: 'stock', input: movements, products, opening }));
    expect(rows.map((row) => row.code)).toContain('BAR');
  });

  it('needs a price list for the day export', () => {
    expect(() => buildExport({ table: 'days', input: days })).toThrow(/needs a price list/);
  });

  it('needs a price list for the stock export', () => {
    expect(() => buildExport({ table: 'stock', input: movements })).toThrow(/needs a price list/);
  });

  it('says what it can export when asked for something else', () => {
    expect(() => buildExport({ table: 'gels', input: checks })).toThrow(
      /nothing called gels to export, try checks, days, stock, annulus/
    );
  });

  it('says the annulus comes off a hydraulics run', () => {
    expect(() => buildExport({ table: 'annulus', input: [] })).toThrow(
      /has to be exported from a hydraulics run/
    );
  });
});

describe('exportCommand', () => {
  it('returns the csv both ways', () => {
    const result = exportCommand({ table: 'checks', input: checks });
    expect(result.lines).toHaveLength(checks.length + 1);
    expect(result.data.endsWith('\n')).toBe(true);
  });

  it('runs from the command line', async () => {
    const io = capture();
    expect(await run(['export', '-t', 'checks', '-i', 'examples/checks-brazos.json'], io)).toBe(0);
    expect(io.out[0].split('\n')[0]).toContain('weight_ppg');
  });

  it('writes to a file when asked', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'shakerdeck-'));
    const path = join(dir, 'checks.csv');
    const io = capture();
    await run(['export', '-t', 'checks', '-i', 'examples/checks-brazos.json', '-o', path], io);
    expect(io.out[0]).toBe(`written to ${path}`);
    expect(readCsv(readFileSync(path, 'utf8'))).toHaveLength(checks.length);
  });

  it('leaves with one on a table it cannot export', async () => {
    const io = capture();
    expect(await run(['export', '-t', 'gels', '-i', 'examples/checks-brazos.json'], io)).toBe(1);
  });
});
