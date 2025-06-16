import { describe, it, expect } from 'vitest';
import { fixtures } from '../support/fixtures.js';
import { buildDaily, renderDaily, dailyLine } from '../../src/report/daily.js';
import { readProgramme } from '../../src/program/window.js';

const check = fixtures.check;
const programme = readProgramme(fixtures.programme);

const full = buildDaily({
  well: 'brazos 14-3',
  date: '2024-08-19',
  reportNumber: 14,
  check,
  programme,
  activity: ['drilled from 9630 to 10450 ft', 'raised weight to 12.4 ppg'],
  products: [{ name: 'barite', quantity: 260, unit: 'sack', value: 4160 }],
  costs: {
    productCost: 5648,
    serviceCharge: 1450,
    rentalCharge: 320,
    haulageCharge: 0,
    total: 7418,
    costPerFoot: 9.05,
  },
  pits: { activeBbl: 812 },
  circulation: { bottomsUpStrokes: 4101, fullCirculationMinutes: 50.6, totalSystemBbl: 710.7 },
});

describe('buildDaily', () => {
  it('reads the check and works the rheology and solids out', () => {
    expect(full.rheology.plasticViscosity).toBe(22);
    expect(full.solids.highGravityPercent).toBe(12.37);
  });

  it('judges the check against the section it was taken in', () => {
    expect(full.compliance.section).toBe('intermediate');
    expect(full.compliance.inWindow).toBe(true);
  });

  it('finds the exception when the mud is out', () => {
    const tight = readProgramme({
      well: 'brazos 14-3',
      sections: [
        { name: 'all', fromFeet: 0, toFeet: 12000, limits: { plasticViscosity: { max: 20 } } },
      ],
    });
    const data = buildDaily({ well: 'x', date: '2024-08-19', check, programme: tight });
    expect(data.compliance.exceptions).toHaveLength(1);
    expect(data.compliance.exceptions[0].property).toBe('plasticViscosity');
  });

  it('has no compliance block without a programme', () => {
    expect(buildDaily({ well: 'x', date: '2024-08-19', check }).compliance).toBe(null);
  });

  it('handles a depth below the deepest section', () => {
    const data = buildDaily({
      well: 'x',
      date: '2024-08-19',
      check: { ...check, depthFeet: 14000 },
      programme,
    });
    expect(data.compliance.section).toBe(null);
    expect(data.compliance.inWindow).toBe(true);
  });

  it('handles a check with nothing but a weight on it', () => {
    const bare = buildDaily({
      well: 'x',
      date: '2024-08-19',
      check: { well: 'x', date: '2024-08-19', depthFeet: 4000, weightPpg: 9.4 },
    });
    expect(bare.rheology).toBe(null);
    expect(bare.solids).toBe(null);
  });
});

describe('renderDaily', () => {
  const lines = renderDaily(full);
  const text = lines.join('\n');

  it('leads with the well and the report number', () => {
    expect(lines[0]).toBe('DAILY MUD REPORT BRAZOS 14-3');
    expect(text).toMatch(/report\s+14/);
  });

  it('prints the blocks in the order the form uses', () => {
    const order = [
      'MUD PROPERTIES',
      'SOLIDS',
      'VOLUMES',
      'PROGRAMME',
      'ACTIVITY',
      'PRODUCTS USED',
      'COST',
    ];
    let last = -1;
    for (const block of order) {
      const at = text.indexOf(block);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
  });

  it('says the mud is in the window when it is', () => {
    expect(text).toContain('inside the intermediate window');
  });

  it('tables the exceptions when it is not', () => {
    const tight = readProgramme({
      well: 'brazos 14-3',
      sections: [
        { name: 'all', fromFeet: 0, toFeet: 12000, limits: { plasticViscosity: { max: 20 } } },
      ],
    });
    const out = renderDaily(
      buildDaily({ well: 'x', date: '2024-08-19', check, programme: tight })
    ).join('\n');
    expect(out).toContain('PROGRAMME EXCEPTIONS');
    expect(out).toMatch(/plastic viscosity\s+22\s+20\s+above/);
  });

  it('leaves out every block that has nothing in it', () => {
    const bare = renderDaily(
      buildDaily({
        well: 'x',
        date: '2024-08-19',
        check: { well: 'x', date: '2024-08-19', depthFeet: 4000, weightPpg: 9.4 },
      })
    ).join('\n');
    expect(bare).not.toContain('SOLIDS');
    expect(bare).not.toContain('ACTIVITY');
    expect(bare).not.toContain('COST');
    expect(bare).not.toContain('VOLUMES');
    expect(bare).toContain('MUD PROPERTIES');
  });

  it('prints the rheology between the funnel and the temperature', () => {
    const at = (label) => text.indexOf(label);
    expect(at('funnel')).toBeLessThan(at('plastic viscosity'));
    expect(at('plastic viscosity')).toBeLessThan(at('temperature'));
  });
});

describe('dailyLine', () => {
  it('is one line for a well followed from town', () => {
    const line = dailyLine(full);
    expect(line).toContain('10450 ft');
    expect(line).toContain('12.4 ppg');
    expect(line).toContain('in window');
  });

  it('names what is out', () => {
    const tight = readProgramme({
      well: 'brazos 14-3',
      sections: [
        { name: 'all', fromFeet: 0, toFeet: 12000, limits: { plasticViscosity: { max: 20 } } },
      ],
    });
    const line = dailyLine(buildDaily({ well: 'x', date: '2024-08-19', check, programme: tight }));
    expect(line).toContain('out on plastic viscosity');
  });

  it('says what was not measured', () => {
    const line = dailyLine(
      buildDaily({
        well: 'x',
        date: '2024-08-19',
        check: { well: 'x', date: '2024-08-19', depthFeet: 4000, weightPpg: 9.4 },
      })
    );
    expect(line).toContain('no rheology');
    expect(line).toContain('no retort');
  });
});
