import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { run } from '../src/cli/program.js';

const pages = readdirSync('docs').filter((file) => file.endsWith('.md'));
const text = Object.fromEntries(pages.map((file) => [file, readFileSync(`docs/${file}`, 'utf8')]));

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

describe('the readme', () => {
  it('does not repeat the whole of a docs page', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme.length).toBeLessThan(
      Object.values(text).reduce((total, body) => total + body.length, 0) * 2
    );
  });
});
