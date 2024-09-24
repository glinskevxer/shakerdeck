import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  renderProgramme,
  renderCompliance,
  programmeCommand,
} from '../../src/cli/commands/programme.js';
import { readProgramme } from '../../src/program/window.js';
import { run } from '../../src/cli/program.js';

const raw = JSON.parse(readFileSync('examples/programme-brazos.json', 'utf8'));
const programme = readProgramme(raw);
const checks = JSON.parse(readFileSync('examples/checks-brazos.json', 'utf8'));
const treatments = JSON.parse(readFileSync('examples/treatments.json', 'utf8'));
const products = JSON.parse(readFileSync('examples/products.json', 'utf8'));

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

describe('renderProgramme', () => {
  const text = renderProgramme(programme).join('\n');

  it('prints a block for every section', () => {
    expect(text).toContain('SURFACE');
    expect(text).toContain('INTERMEDIATE');
  });

  it('tables the windows', () => {
    expect(text).toMatch(/weightPpg\s+12\s+12\.8/);
  });

  it('names the properties nothing has a window on', () => {
    expect(text).toMatch(/no window anywhere on/);
    expect(text).toContain('chlorideMgL');
  });

  it('says nothing about unused windows when every one is set', () => {
    const full = readProgramme({
      well: 'x',
      sections: [
        {
          name: 'all',
          fromFeet: 0,
          toFeet: 100,
          limits: {
            weightPpg: { min: 9 },
            funnelSeconds: { min: 30 },
            plasticViscosity: { max: 30 },
            yieldPoint: { max: 30 },
            filtrateApiMl: { max: 10 },
            ph: { min: 9 },
            chlorideMgL: { max: 1 },
            solidsPercent: { max: 20 },
            mbtLbBbl: { max: 25 },
            sandPercent: { max: 1 },
          },
        },
      ],
    });
    expect(renderProgramme(full).join('\n')).not.toMatch(/no window anywhere/);
  });
});

describe('renderCompliance', () => {
  const compliance = renderCompliance(programme, checks);

  it('counts the checks it judged', () => {
    expect(compliance.report.judged).toBe(6);
  });

  it('finds the one check that went outside', () => {
    expect(compliance.report.outside).toBe(1);
    expect(compliance.properties[0].property).toBe('filtrateApiMl');
  });

  it('prints the table of properties', () => {
    expect(compliance.lines.join('\n')).toContain('BY PROPERTY');
  });

  it('says nothing about suspects when nothing is chronic', () => {
    expect(compliance.suspects).toEqual([]);
    expect(compliance.lines.join('\n')).not.toContain('WINDOWS WORTH REVISITING');
  });
});

describe('programmeCommand', () => {
  it('prints the programme with nothing else given', () => {
    expect(programmeCommand({ programme: raw }).lines[0]).toBe('MUD PROGRAMME BRAZOS 14-3');
  });

  it('judges checks when they are given', () => {
    const result = programmeCommand({ programme: raw, checks });
    expect(result.lines[0]).toBe('PROGRAMME COMPLIANCE BRAZOS 14-3');
  });

  it('plans a section when one is named', () => {
    const result = programmeCommand({
      programme: raw,
      plan: { section: 'intermediate', treatments, products, surfaceSystemBbl: 500 },
    });
    expect(result.lines[0]).toBe('SECTION PLAN INTERMEDIATE');
    expect(result.data.costPerFoot).toBeGreaterThan(0);
  });

  it('refuses a section that is not in the programme', () => {
    expect(() =>
      programmeCommand({
        programme: raw,
        plan: { section: 'production', treatments, products, surfaceSystemBbl: 500 },
      })
    ).toThrow(/no section called production/);
  });

  it('runs all three ways from the command line', async () => {
    const plain = capture();
    expect(await run(['programme', '-p', 'examples/programme-brazos.json'], plain)).toBe(0);
    const judged = capture();
    expect(
      await run(
        ['programme', '-p', 'examples/programme-brazos.json', '-c', 'examples/checks-brazos.json'],
        judged
      )
    ).toBe(0);
    const planned = capture();
    expect(
      await run(
        [
          'programme',
          '-p',
          'examples/programme-brazos.json',
          '-s',
          'intermediate',
          '-t',
          'examples/treatments.json',
          '-P',
          'examples/products.json',
        ],
        planned
      )
    ).toBe(0);
    expect(planned.out.join('\n')).toContain('SECTION PLAN');
  });
});
