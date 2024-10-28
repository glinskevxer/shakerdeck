import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const dockerfile = readFileSync('Dockerfile', 'utf8');
const dockerignore = readFileSync('.dockerignore', 'utf8');

describe('the manifest', () => {
  it('ships the entry point and the source', () => {
    expect(manifest.files).toEqual(['bin', 'src']);
    expect(manifest.bin.shakerdeck).toBe('bin/shakerdeck.js');
    expect(existsSync(manifest.bin.shakerdeck)).toBe(true);
  });

  it('pins every dependency exactly', () => {
    const all = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const [name, version] of Object.entries(all)) {
      expect(`${name}@${version}`).toMatch(/@\d+\.\d+\.\d+$/);
    }
  });

  it('carries one runtime dependency', () => {
    expect(Object.keys(manifest.dependencies)).toEqual(['commander']);
  });

  it('asks for a node the image actually has', () => {
    const image = dockerfile.match(/FROM node:(\d+)\.\d+\.\d+/);
    const engine = manifest.engines.node.match(/>=(\d+)\./);
    expect(Number(image[1])).toBeGreaterThanOrEqual(Number(engine[1]));
  });

  it('has a script for every job the workflow runs', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    for (const script of workflow.matchAll(/npm run ([a-z:]+)/g)) {
      expect(Object.keys(manifest.scripts)).toContain(script[1]);
    }
  });
});

describe('the image', () => {
  it('copies in everything the entry point needs at runtime', () => {
    for (const directory of ['bin', 'src', 'examples']) {
      expect(dockerfile).toMatch(new RegExp(`COPY ${directory} `));
      expect(existsSync(directory)).toBe(true);
    }
  });

  it('installs without the development tree', () => {
    expect(dockerfile).toContain('npm ci --omit=dev');
  });

  it('does not run as root', () => {
    expect(dockerfile).toMatch(/^USER (?!root)/m);
  });

  it('leaves the test runner and the scripts out', () => {
    for (const excluded of ['tests', 'scripts', 'node_modules', 'coverage']) {
      expect(dockerignore).toContain(excluded);
    }
  });

  it('has an entry point that points at a file that exists', () => {
    const entry = dockerfile.match(/ENTRYPOINT \["node", "\/app\/(.+?)"\]/);
    expect(existsSync(entry[1])).toBe(true);
  });
});

describe('the examples the image carries', () => {
  it('are all valid json', () => {
    for (const file of readdirSync('examples')) {
      expect(() => JSON.parse(readFileSync(`examples/${file}`, 'utf8'))).not.toThrow();
    }
  });

  it('are all referred to by the smoke test', () => {
    const smoke = readFileSync('scripts/smoke.sh', 'utf8');
    for (const file of readdirSync('examples')) {
      expect(smoke).toContain(file);
    }
  });
});
