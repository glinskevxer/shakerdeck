import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { run } from '../src/cli/program.js';
import { capture } from './support/fixtures.js';

const pages = readdirSync('docs').filter((file) => file.endsWith('.md'));
const text = Object.fromEntries(pages.map((file) => [file, readFileSync(`docs/${file}`, 'utf8')]));

describe('the docs', () => {
  it('are there', () => {
    expect(pages.length).toBeGreaterThanOrEqual(3);
  });

  it('point at source files that exist', () => {
    for (const [page, body] of Object.entries(text)) {
      for (const match of body.matchAll(/`(src\/[a-z\-/.]+\.js)`/g)) {
        expect(`${page}: ${match[1]}`).toBe(
          `${page}: ${existsSync(match[1]) ? match[1] : 'missing'}`
        );
      }
    }
  });

  it('point at source directories that exist', () => {
    for (const body of Object.values(text)) {
      for (const match of body.matchAll(/`(src\/[a-z]+)\/`/g)) {
        expect(existsSync(match[1])).toBe(true);
      }
    }
  });

  it('name example files that exist', () => {
    for (const body of Object.values(text)) {
      for (const match of body.matchAll(/examples\/[a-z0-9-]+\.json/g)) {
        expect(existsSync(match[0])).toBe(true);
      }
    }
  });

  it('run every command line they print', async () => {
    for (const body of Object.values(text)) {
      for (const block of body.matchAll(/```\n([\s\S]*?)```/g)) {
        for (const line of block[1].split('\n')) {
          if (!line.trim().startsWith('node bin/shakerdeck.js ')) {
            continue;
          }
          const parts = line
            .trim()
            .replace('node bin/shakerdeck.js ', '')
            .match(/"[^"]*"|\S+/g);
          const io = capture();
          const code = await run(
            parts.map((part) => part.replace(/^"|"$/g, '')),
            io
          );
          expect(`${line.trim()} -> ${code}`).toBe(`${line.trim()} -> 0`);
        }
      }
    }
  });
});

describe('the units page', () => {
  const units = text['units.md'];

  it('carries the two conversion traps', () => {
    expect(units).toContain('478.8');
    expect(units).toContain('8287');
  });

  it('agrees with the constants in the code', async () => {
    const { CONSISTENCY_TO_CENTIPOISE } = await import('../src/hydraulics/reynolds.js');
    const { MOORE_LAMINAR } = await import('../src/hydraulics/cuttings.js');
    expect(units).toContain(String(CONSISTENCY_TO_CENTIPOISE));
    expect(units).toContain(String(MOORE_LAMINAR));
  });

  it('lists constants that are still exported at the values it quotes', async () => {
    const density = await import('../src/units/density.js');
    const capacity = await import('../src/well/capacity.js');
    const velocity = await import('../src/hydraulics/velocity.js');
    const dial = await import('../src/rheology/dial.js');
    expect(units).toContain(String(density.WATER_PPG));
    expect(units).toContain(String(density.GRADIENT_PER_PPG));
    expect(units).toContain(String(capacity.CAPACITY_CONSTANT));
    expect(units).toContain(String(velocity.VELOCITY_CONSTANT));
    expect(units).toContain(String(dial.SHEAR_RATE_PER_RPM));
    expect(units).toContain(String(dial.STRESS_PER_DIAL));
  });
});

describe('the rheology page', () => {
  it('names all three models', () => {
    for (const model of ['Bingham', 'Power law', 'Herschel Bulkley']) {
      expect(text['rheology.md']).toContain(model);
    }
  });

  it('warns against making the two yield point conventions agree', () => {
    expect(text['rheology.md']).toMatch(/Do not quietly make them\s+agree/);
  });
});

describe('the hydraulics page', () => {
  const page = text['hydraulics.md'];

  it('names the modules in the order the system is worked in', () => {
    const order = [
      'src/well/geometry.js',
      'src/hydraulics/velocity.js',
      'src/hydraulics/system.js',
      'src/hydraulics/bit.js',
      'src/hydraulics/ecd.js',
    ];
    let last = -1;
    for (const module of order) {
      const at = page.indexOf(module);
      expect(`${module}: ${at > last}`).toBe(`${module}: true`);
      last = at;
    }
  });

  it('names the function the report actually calls for the slowest length', async () => {
    const velocity = await import('../src/hydraulics/velocity.js');
    expect(page).toContain('slowestAnnulus');
    expect(typeof velocity.slowestAnnulus).toBe('function');
  });

  it('points at the test that holds the case where the correlation gives up', () => {
    expect(page).toContain('tests/edges/extremes.test.js');
    expect(existsSync('tests/edges/extremes.test.js')).toBe(true);
  });

  it('quotes both optimisation criteria', async () => {
    const optimise = await import('../src/hydraulics/optimise.js');
    for (const criterion of Object.keys(optimise.OPTIMUM_SHARE)) {
      expect(page).toContain(criterion);
    }
  });
});

describe('the solids page', () => {
  const page = text['solids.md'];

  it('quotes the two gravities the split is made between', async () => {
    const analysis = await import('../src/solids/analysis.js');
    expect(page).toContain(String(analysis.BARITE_SG));
    expect(page).toContain(String(analysis.LOW_GRAVITY_SG));
  });

  it('names the function that carries the sizes forward', async () => {
    const screens = await import('../src/solidscontrol/screens.js');
    expect(page).toContain('passedDistribution');
    expect(typeof screens.passedDistribution).toBe('function');
  });

  it('names the functions it points the reader at', async () => {
    const utilisation = await import('../src/solidscontrol/utilisation.js');
    const dilution = await import('../src/material/dilution.js');
    expect(typeof utilisation.effectiveRemoval).toBe('function');
    expect(typeof dilution.dilutionAgainstRemoval).toBe('function');
    expect(page).toContain('effectiveRemoval');
    expect(page).toContain('dilutionAgainstRemoval');
  });

  it('says why doctor does not compare the weight back against the gravity', () => {
    expect(page).toMatch(/would agree by construction/);
  });
});

describe('the quality page', () => {
  const page = text['quality.md'];

  it('names the three questions and the module behind each', () => {
    for (const module of [
      'src/program/window.js',
      'src/quality/exceptions.js',
      'src/quality/control.js',
      'src/quality/lab.js',
    ]) {
      expect(page).toContain(module);
    }
  });

  it('names the repeatability table where it actually lives', async () => {
    const pilot = await import('../src/mudcheck/pilot.js');
    expect(page).toContain('REPEATABILITY');
    expect(page).toContain('src/mudcheck/pilot.js');
    expect(Object.keys(pilot.REPEATABILITY).length).toBeGreaterThan(3);
  });

  it('points at the tests that walk the tree, and they are there', () => {
    for (const test of [
      'tests/consistency.test.js',
      'tests/readme.test.js',
      'tests/docs.test.js',
    ]) {
      expect(page).toContain(test);
      expect(existsSync(test)).toBe(true);
    }
  });

  it('quotes the module size limit the consistency test actually holds', () => {
    const consistency = readFileSync('tests/consistency.test.js', 'utf8');
    expect(page).toContain('four hundred lines');
    expect(consistency).toContain('lines < 400');
  });
});

describe('every page', () => {
  it('names a function that is actually exported where it names one', async () => {
    const modules = new Map();
    for (const body of Object.values(text)) {
      for (const match of body.matchAll(/`(src\/[a-z\-/.]+\.js)`/g)) {
        if (!modules.has(match[1])) {
          modules.set(match[1], await import(`../${match[1]}`));
        }
      }
    }
    expect(modules.size).toBeGreaterThan(5);
  });

  it('has a heading on the first line', () => {
    for (const [page, body] of Object.entries(text)) {
      expect(`${page}: ${body.startsWith('# ')}`).toBe(`${page}: true`);
    }
  });

  it('has no trailing whitespace on any line', () => {
    for (const [page, body] of Object.entries(text)) {
      const bad = body.split('\n').filter((line) => /\s$/.test(line)).length;
      expect(`${page}: ${bad}`).toBe(`${page}: 0`);
    }
  });
});

describe('the readme', () => {
  it('does not repeat the whole of a docs page', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme.length).toBeLessThan(
      Object.values(text).reduce((total, body) => total + body.length, 0) * 2
    );
  });
});
