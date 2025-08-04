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

describe('the changelog', () => {
  const changelog = readFileSync('CHANGELOG.md', 'utf8');

  it('covers the version in the manifest', () => {
    expect(changelog).toContain(`## ${manifest.version}`);
  });

  it('leads with a version heading', () => {
    expect(changelog.split('\n')[0]).toBe('# Changelog');
    expect(changelog).toMatch(/\n## \d+\.\d+\.\d+\n/);
  });

  it('names every command the tool carries', async () => {
    const { buildProgram } = await import('../src/cli/program.js');
    const named = buildProgram()
      .commands.map((command) => command.name())
      .filter((name) => name !== 'commands' && name !== 'export' && name !== 'mix');
    const missing = named.filter(
      (name) => !changelog.includes(name) && !readFileSync('README.md', 'utf8').includes(name)
    );
    expect(missing).toEqual([]);
  });
});

describe('what the manifest says it is', () => {
  it('describes itself in a sentence', () => {
    expect(manifest.description.length).toBeGreaterThan(30);
    expect(manifest.description).toMatch(/drilling fluids/);
  });

  it('carries keywords somebody would search for', () => {
    expect(manifest.keywords.length).toBeGreaterThanOrEqual(6);
    for (const keyword of manifest.keywords) {
      expect(keyword).toMatch(/^[a-z-]+$/);
    }
  });

  it('names an author and a licence', () => {
    expect(manifest.author).toMatch(/@/);
    expect(manifest.license).toBe('MIT');
    expect(existsSync('LICENSE')).toBe(true);
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

describe('the files that describe the project', () => {
  const readme = readFileSync('README.md', 'utf8');

  it('all exist', () => {
    for (const file of ['README.md', 'CHANGELOG.md', 'LICENSE', 'package.json']) {
      expect(`${file}: ${existsSync(file)}`).toBe(`${file}: true`);
    }
  });

  it('agree on the licence', () => {
    const licence = readFileSync('LICENSE', 'utf8');
    expect(licence).toContain('MIT License');
    expect(readme).toContain('MIT');
    expect(manifest.license).toBe('MIT');
  });

  it('agree on what the tool is for', () => {
    const first = readme.split('\n').find((line) => line.length > 20 && !line.startsWith('#'));
    expect(first.toLowerCase()).toContain('drilling fluids');
    expect(manifest.description.toLowerCase()).toContain('drilling fluids');
  });

  it('name the same command', () => {
    expect(readme).toContain('node bin/shakerdeck.js');
    expect(Object.keys(manifest.bin)).toEqual(['shakerdeck']);
    expect(manifest.name).toBe('shakerdeck');
  });

  it('leave no file in the root that nothing refers to', () => {
    const root = readdirSync('.', { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('.'));
    const known = [
      'README.md',
      'CHANGELOG.md',
      'LICENSE',
      'package.json',
      'package-lock.json',
      'Dockerfile',
      'eslint.config.js',
      'vitest.config.js',
    ];
    for (const name of root) {
      expect(`${name}: ${known.includes(name)}`).toBe(`${name}: true`);
    }
  });

  it('keep the dot files that the tooling needs', () => {
    for (const file of [
      '.gitignore',
      '.dockerignore',
      '.prettierrc.json',
      '.prettierignore',
      '.editorconfig',
    ]) {
      expect(`${file}: ${existsSync(file)}`).toBe(`${file}: true`);
    }
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
