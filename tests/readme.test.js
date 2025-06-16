import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { run, buildProgram } from '../src/cli/program.js';
import { capture } from './support/fixtures.js';
import { listCommands } from '../src/cli/commands/commands.js';

const readme = readFileSync('README.md', 'utf8');

function commandLines() {
  const lines = [];
  for (const block of readme.matchAll(/```\n([\s\S]*?)```/g)) {
    for (const line of block[1].split('\n')) {
      if (line.startsWith('node bin/shakerdeck.js ')) {
        lines.push(line.trim());
      }
    }
  }
  return lines;
}

function argv(line) {
  const parts = line.replace('node bin/shakerdeck.js ', '').match(/"[^"]*"|\S+/g) ?? [];
  return parts.map((part) => part.replace(/^"|"$/g, ''));
}

describe('the readme', () => {
  it('shows at least one command line', () => {
    expect(commandLines().length).toBeGreaterThan(10);
  });

  it('runs every command line it prints', async () => {
    for (const line of commandLines()) {
      const io = capture();
      const code = await run(argv(line), io);
      expect(`${line} -> ${code} ${io.err.join(' ')}`).toBe(`${line} -> 0 `);
    }
  });

  it('names every file it tells the reader to pass', () => {
    for (const match of readme.matchAll(/examples\/[a-z0-9-]+\.json/g)) {
      expect(existsSync(match[0])).toBe(true);
    }
  });

  it('shows every command the tool carries', () => {
    for (const row of listCommands(buildProgram())) {
      expect(readme).toContain(`### ${row.command}`);
    }
  });

  it('does not show a command that no longer exists', () => {
    const names = listCommands(buildProgram()).map((row) => row.command);
    for (const heading of readme.matchAll(/^### ([a-z]+)$/gm)) {
      expect(names).toContain(heading[1]);
    }
  });

  it('lists every source directory that exists', () => {
    for (const directory of readdirSync('src', { withFileTypes: true })) {
      if (!directory.isDirectory()) {
        continue;
      }
      expect(readme).toContain(`src/${directory.name}/`);
    }
  });

  it('does not list a source directory that is gone', () => {
    const present = readdirSync('src', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    for (const match of readme.matchAll(/`src\/([a-z]+)\/`/g)) {
      expect(present).toContain(match[1]);
    }
  });

  it('shows every npm script it tells the reader to run', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    for (const match of readme.matchAll(/npm run ([a-z:]+)/g)) {
      expect(Object.keys(manifest.scripts)).toContain(match[1]);
    }
  });
});
