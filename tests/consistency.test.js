import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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

const sources = walk('src').filter((path) => path !== 'src/index.js');
const testFiles = walk('tests');
const allTestText = testFiles.map((path) => readFileSync(path, 'utf8')).join('\n');

function exportsOf(path) {
  const text = readFileSync(path, 'utf8');
  const names = [];
  for (const match of text.matchAll(/^export (?:async )?function ([A-Za-z0-9_]+)/gm)) {
    names.push(match[1]);
  }
  for (const match of text.matchAll(/^export const ([A-Z][A-Za-z0-9_]*)/gm)) {
    names.push(match[1]);
  }
  for (const match of text.matchAll(/^export class ([A-Za-z0-9_]+)/gm)) {
    names.push(match[1]);
  }
  return names;
}

describe('every source file', () => {
  it('has a test file beside it in tests', () => {
    for (const source of sources) {
      // The command modules live one directory deeper than their tests, which
      // keeps tests/cli flat and readable.
      const expected = join(
        'tests',
        `${relative('src', source).replace('cli/commands/', 'cli/').replace(/\.js$/, '')}.test.js`
      );
      expect(`${source} -> ${existsSync(expected) ? 'tested' : expected}`).toBe(
        `${source} -> tested`
      );
    }
  });

  it('opens with a comment saying what it is for', () => {
    for (const source of sources) {
      const text = readFileSync(source, 'utf8');
      expect(`${source}: ${text.startsWith('/**') ? 'documented' : 'undocumented'}`).toBe(
        `${source}: documented`
      );
    }
  });

  it('exports something', () => {
    for (const source of sources) {
      expect(`${source}: ${exportsOf(source).length}`).not.toBe(`${source}: 0`);
    }
  });

  it('has every export named somewhere in the tests', () => {
    for (const source of sources) {
      for (const name of exportsOf(source)) {
        expect(`${source} ${name}: ${allTestText.includes(name) ? 'named' : 'never tested'}`).toBe(
          `${source} ${name}: named`
        );
      }
    }
  });

  it('is not empty', () => {
    for (const source of sources) {
      expect(statSync(source).size).toBeGreaterThan(200);
    }
  });
});

describe('every test file', () => {
  it('has a source file it belongs to', () => {
    const standalone = new Set([
      'tests/packaging.test.js',
      'tests/readme.test.js',
      'tests/docs.test.js',
      'tests/consistency.test.js',
      'tests/coverage-gaps.test.js',
    ]);
    for (const test of testFiles) {
      if (
        standalone.has(test) ||
        test.startsWith('tests/integration') ||
        test.startsWith('tests/property') ||
        test.startsWith('tests/edges') ||
        test.startsWith('tests/support')
      ) {
        continue;
      }
      const stem = relative('tests', test).replace(/\.test\.js$/, '');
      const candidates = [
        join('src', `${stem}.js`),
        join('src', `${stem.replace('cli/', 'cli/commands/')}.js`),
      ];
      const paired = candidates.some((candidate) => existsSync(candidate));
      expect(`${test} -> ${paired ? 'paired' : candidates.join(' or ')}`).toBe(`${test} -> paired`);
    }
  });

  it('actually asserts something', () => {
    for (const test of testFiles.filter((path) => path.endsWith('.test.js'))) {
      expect(`${test}: ${readFileSync(test, 'utf8').includes('expect(')}`).toBe(`${test}: true`);
    }
  });
});

describe('the library entry point', () => {
  const index = readFileSync('src/index.js', 'utf8');

  it('re-exports a namespace for every domain directory', () => {
    for (const entry of readdirSync('src', { withFileTypes: true })) {
      if (
        !entry.isDirectory() ||
        entry.name === 'cli' ||
        entry.name === 'valid' ||
        entry.name === 'util'
      ) {
        continue;
      }
      expect(`${entry.name}: ${index.includes(`./${entry.name}/`) ? 'exported' : 'missing'}`).toBe(
        `${entry.name}: exported`
      );
    }
  });

  it('points only at files that exist', () => {
    for (const match of index.matchAll(/from '\.\/(.+?)'/g)) {
      expect(existsSync(join('src', match[1]))).toBe(true);
    }
  });
});

describe('house style', () => {
  it('keeps every module under four hundred lines', () => {
    for (const source of sources) {
      const lines = readFileSync(source, 'utf8').split('\n').length;
      expect(`${source}: ${lines < 400 ? 'short enough' : lines}`).toBe(`${source}: short enough`);
    }
  });

  it('never leaves a console call in the source outside the command line', () => {
    for (const source of sources) {
      if (source.startsWith('src/cli')) {
        continue;
      }
      expect(`${source}: ${/console\./.test(readFileSync(source, 'utf8'))}`).toBe(
        `${source}: false`
      );
    }
  });

  it('never reads the system clock outside the one helper that takes it as an argument', () => {
    for (const source of sources) {
      if (source === 'src/util/clock.js') {
        continue;
      }
      const text = readFileSync(source, 'utf8');
      expect(`${source}: ${/Date\.now\(\)|new Date\(\)/.test(text)}`).toBe(`${source}: false`);
    }
  });

  it('never reads a process environment variable', () => {
    for (const source of sources) {
      expect(`${source}: ${/process\.env/.test(readFileSync(source, 'utf8'))}`).toBe(
        `${source}: false`
      );
    }
  });
});
