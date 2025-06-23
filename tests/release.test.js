import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const script = readFileSync('scripts/release-check.sh', 'utf8');
const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

describe('the release check', () => {
  it('is wired into the manifest', () => {
    expect(manifest.scripts['release:check']).toBe('bash scripts/release-check.sh');
    expect(existsSync('scripts/release-check.sh')).toBe(true);
  });

  it('is one of the things npm run check runs', () => {
    expect(manifest.scripts.check).toContain('release:check');
  });

  it('runs in continuous integration', () => {
    expect(workflow).toContain('npm run release:check');
  });

  it('stops on the first failure', () => {
    expect(script).toContain('set -euo pipefail');
  });

  it('cleans up after itself whatever happens', () => {
    expect(script).toMatch(/trap 'rm -rf/);
  });

  it('checks for every file the package has to carry', () => {
    for (const path of ['package.json', 'bin/shakerdeck.js', 'src/index.js', 'LICENSE']) {
      expect(script).toContain(path);
    }
  });

  it('checks for everything the package must not carry', () => {
    for (const path of ['tests', 'scripts', 'node_modules', 'coverage']) {
      expect(script).toContain(path);
    }
  });

  it('runs the entry point out of the packed tree rather than the working one', () => {
    expect(script).toContain('cd "$PACKED"');
    expect(script).toContain('node bin/shakerdeck.js');
  });
});

describe('what the manifest says it ships', () => {
  it('names only directories that exist', () => {
    for (const entry of manifest.files) {
      expect(existsSync(entry)).toBe(true);
    }
  });

  it('does not ship the tests', () => {
    expect(manifest.files).not.toContain('tests');
  });

  it('names an entry point inside what it ships', () => {
    expect(manifest.files.some((entry) => manifest.main.startsWith(entry))).toBe(true);
    expect(manifest.files.some((entry) => manifest.bin.shakerdeck.startsWith(entry))).toBe(true);
  });

  it('is private, so nothing can publish it by accident', () => {
    expect(manifest.private).toBe(true);
  });
});

describe('every npm script', () => {
  it('points at a file that exists where it names one', () => {
    for (const command of Object.values(manifest.scripts)) {
      for (const match of command.matchAll(/(scripts\/[a-z-]+\.sh)/g)) {
        expect(existsSync(match[1])).toBe(true);
      }
    }
  });

  it('is either run by check or is a variant of one that is', () => {
    const run = new Set(
      manifest.scripts.check.split('&&').map((part) => part.trim().replace('npm run ', ''))
    );
    const exempt = new Set(['check', 'test:watch', 'format', 'coverage', 'test', 'audit']);
    for (const name of Object.keys(manifest.scripts)) {
      expect(`${name}: ${run.has(name) || exempt.has(name)}`).toBe(`${name}: true`);
    }
  });
});
