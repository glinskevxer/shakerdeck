import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as library from '../src/index.js';

function walk(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(path));
    } else if (entry.name.endsWith('.js')) {
      found.push(path);
    }
  }
  return found;
}

/**
 * Everything a caller using the library rather than the command line should be
 * able to reach. The command line, the shape checker and the small internal
 * helpers are deliberately not part of the surface.
 */
const domain = walk('src').filter(
  (path) =>
    path !== 'src/index.js' &&
    path !== 'src/version.js' &&
    !path.startsWith('src/cli') &&
    !path.startsWith('src/util') &&
    !path.startsWith('src/valid')
);

const index = readFileSync('src/index.js', 'utf8');

describe('the library entry point', () => {
  it('re-exports every domain module', () => {
    for (const path of domain) {
      const specifier = `./${relative('src', path)}`;
      expect(`${specifier}: ${index.includes(specifier) ? 'exported' : 'missing'}`).toBe(
        `${specifier}: exported`
      );
    }
  });

  it('exports a namespace for each of them', () => {
    const names = Object.keys(library);
    expect(names.length).toBeGreaterThanOrEqual(domain.length);
  });

  it('gives every namespace a distinct name', () => {
    const names = Object.keys(library);
    expect(new Set(names).size).toBe(names.length);
  });

  it('points only at files that exist', () => {
    const paths = [...index.matchAll(/from '\.\/(.+?)'/g)].map((match) => match[1]);
    for (const path of paths) {
      expect(walk('src')).toContain(join('src', path));
    }
  });

  it('exports no empty namespace', () => {
    for (const [name, value] of Object.entries(library)) {
      if (name === 'VERSION') {
        continue;
      }
      expect(`${name}: ${Object.keys(value).length > 0}`).toBe(`${name}: true`);
    }
  });

  it('carries the version', () => {
    expect(library.VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('reaches the rheology, the hydraulics and the material balance', () => {
    expect(typeof library.bingham.binghamSummary).toBe('function');
    expect(typeof library.system.systemPressure).toBe('function');
    expect(typeof library.weightup.weightUp).toBe('function');
    expect(typeof library.solids.soliditySplit).toBe('function');
  });

  it('reaches the reports', () => {
    expect(typeof library.dailyReport.buildDaily).toBe('function');
    expect(typeof library.recap.buildRecap).toBe('function');
    expect(typeof library.morning.buildMorning).toBe('function');
    expect(typeof library.sectionReport.buildSectionReport).toBe('function');
  });

  it('does not expose the command line', () => {
    expect(index).not.toContain('./cli/');
  });
});
