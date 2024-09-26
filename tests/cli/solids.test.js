import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  readSolidsControl,
  renderSolidsControl,
  solidsCommand,
} from '../../src/cli/commands/solids.js';
import { run } from '../../src/cli/program.js';

const spread = JSON.parse(readFileSync('examples/solids-control.json', 'utf8'));

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

describe('readSolidsControl', () => {
  const data = readSolidsControl(spread);

  it('starts from the solids the bit made', () => {
    expect(data.solidsMadeBbl).toBeGreaterThan(60);
  });

  it('runs one stage for each piece of equipment', () => {
    expect(data.stages.map((row) => row.stage)).toEqual([
      'shaker api 170',
      'shaker api 200',
      'desander',
      'desilter',
    ]);
  });

  it('feeds each stage what the one before it left', () => {
    for (let i = 1; i < data.stages.length; i += 1) {
      expect(data.stages[i].feedBbl).toBeCloseTo(data.stages[i - 1].passedBbl, 2);
    }
  });

  it('balances over the whole train', () => {
    expect(data.removedBbl + data.passedBbl).toBeCloseTo(data.solidsMadeBbl, 1);
  });

  it('runs the centrifuge when there is one', () => {
    expect(data.centrifuge.bariteRecoveredPounds).toBeGreaterThan(0);
  });

  it('leaves the centrifuge out when there is not', () => {
    expect(readSolidsControl({ ...spread, centrifuge: null }).centrifuge).toBe(null);
  });

  it('runs with no cones at all', () => {
    const shakersOnly = readSolidsControl({ ...spread, cones: [] });
    expect(shakersOnly.stages).toHaveLength(2);
  });

  it('compares what it did against dilution alone', () => {
    expect(data.comparison.dilutionOnlyBbl).toBeGreaterThan(data.comparison.withRemovalBbl);
  });

  it('removes nothing over no footage', () => {
    const nothing = readSolidsControl({ ...spread, footageFeet: 0 });
    expect(nothing.removedBbl).toBe(0);
    expect(nothing.removalEfficiency).toBe(0);
  });
});

describe('renderSolidsControl', () => {
  const text = renderSolidsControl(readSolidsControl(spread)).join('\n');

  it('prints each block', () => {
    for (const block of ['THE TRAIN', 'CENTRIFUGE', 'AGAINST DILUTION ALONE']) {
      expect(text).toContain(block);
    }
  });

  it('tables the train with a row for every stage', () => {
    expect(text).toContain('shaker api 170');
    expect(text).toContain('desilter');
  });

  it('leaves the centrifuge block out when there is none', () => {
    const without = renderSolidsControl(readSolidsControl({ ...spread, centrifuge: null })).join(
      '\n'
    );
    expect(without).not.toContain('CENTRIFUGE');
  });
});

describe('the command', () => {
  it('returns the data and the page', () => {
    const result = solidsCommand(spread);
    expect(result.data.well).toBe('brazos 14-3');
    expect(result.lines.length).toBeGreaterThan(15);
  });

  it('runs from the command line', async () => {
    const io = capture();
    expect(await run(['solids', '-s', 'examples/solids-control.json'], io)).toBe(0);
    expect(io.out.join('\n')).toContain('SOLIDS CONTROL BRAZOS 14-3');
  });
});
