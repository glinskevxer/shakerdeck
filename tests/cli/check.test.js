import { describe, it, expect } from 'vitest';
import { readCheckSheet, renderCheck, checkCommand } from '../../src/cli/commands/check.js';
import { readFileSync } from 'node:fs';

const record = JSON.parse(readFileSync('examples/check-brazos.json', 'utf8'));

describe('readCheckSheet', () => {
  const data = readCheckSheet(record);

  it('carries the header of the check', () => {
    expect(data.well).toBe('brazos 14-3');
    expect(data.depthFeet).toBe(10450);
    expect(data.samplePoint).toBe('flowline');
  });

  it('fills in every density unit', () => {
    expect(data.density.ppg).toBe(12.4);
    expect(data.density.sg).toBe(1.486);
  });

  it('works the rheology out', () => {
    expect(data.rheology.plasticViscosity).toBe(22);
    expect(data.rheology.yieldPoint).toBe(20);
  });

  it('splits the solids', () => {
    expect(data.solids.highGravityPercent).toBe(12.37);
    expect(data.solids.drilledPercent).toBe(3.71);
  });

  it('uses the retort water for the excess lime', () => {
    expect(data.alkalinity.excessLimeLbBbl).toBe(0.38);
  });

  it('leaves out what was not measured', () => {
    const bare = readCheckSheet({
      well: 'ward 2',
      date: '2024-08-19',
      depthFeet: 4000,
      weightPpg: 9.4,
    });
    expect(bare.rheology).toBe(null);
    expect(bare.gels).toBe(null);
    expect(bare.solids).toBe(null);
    expect(bare.alkalinity).toBe(null);
    expect(bare.chemistry).toBe(null);
    expect(bare.clay).toBe(null);
  });

  it('reads a gel sheet with the thirty minute left blank', () => {
    expect(readCheckSheet(record).gels.thirtyMinute).toBe(null);
  });
});

describe('renderCheck', () => {
  const lines = renderCheck(readCheckSheet(record));

  it('leads with the well', () => {
    expect(lines[0]).toBe('MUD CHECK BRAZOS 14-3');
  });

  it('prints every block that has readings', () => {
    const text = lines.join('\n');
    for (const block of ['DENSITY', 'RHEOLOGY', 'GELS', 'SOLIDS', 'ALKALINITY', 'CHEMISTRY']) {
      expect(text).toContain(block);
    }
  });

  it('prints the solids as a table', () => {
    const text = lines.join('\n');
    expect(text).toMatch(/high gravity\s+12\.37\s+181\.8/);
  });

  it('leaves a block out when nothing was measured for it', () => {
    const text = renderCheck(
      readCheckSheet({ well: 'ward 2', date: '2024-08-19', depthFeet: 4000, weightPpg: 9.4 })
    ).join('\n');
    expect(text).not.toContain('RHEOLOGY');
    expect(text).not.toContain('ALKALINITY');
    expect(text).toContain('DENSITY');
  });

  it('prints the note when there is one', () => {
    expect(lines.join('\n')).toContain('raised weight over the tour');
  });
});

describe('checkCommand', () => {
  it('returns both the data and the page', () => {
    const result = checkCommand(record);
    expect(result.data.well).toBe('brazos 14-3');
    expect(result.lines.length).toBeGreaterThan(20);
  });
});
