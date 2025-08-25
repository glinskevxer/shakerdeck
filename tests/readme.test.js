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

  it('links to every docs page that exists', () => {
    for (const page of readdirSync('docs')) {
      const name = page.replace(/\.md$/, '');
      expect(`${page}: ${readme.includes(`docs/${page}`)}`).toBe(`${page}: true`);
      expect(`${page}: ${readme.includes(`[${name}]`)}`).toBe(`${page}: true`);
    }
  });

  it('links to no docs page that does not', () => {
    for (const match of readme.matchAll(/\(docs\/([a-z-]+\.md)\)/g)) {
      expect(existsSync(`docs/${match[1]}`)).toBe(true);
    }
  });

  it('says what the tool will not do as well as what it will', () => {
    expect(readme).toContain('What it will not do');
    expect(readme).toMatch(/does not talk to a network/);
  });

  it('agrees with the workflow page about not recommending anything', () => {
    const workflow = readFileSync('docs/workflow.md', 'utf8');
    expect(readme).toContain('none of them recommend');
    expect(workflow).toContain('none of them recommend');
  });

  it('shows every npm script it tells the reader to run', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    for (const match of readme.matchAll(/npm run ([a-z:]+)/g)) {
      expect(Object.keys(manifest.scripts)).toContain(match[1]);
    }
  });
});

describe('the readme against the tool', () => {
  const readme = readFileSync('README.md', 'utf8');

  it('shows an example for every command that takes a file', () => {
    for (const row of listCommands(buildProgram())) {
      const takesAFile = row.options.some((option) => option.flags.includes('<file>'));
      if (!takesAFile) {
        continue;
      }
      const section = readme.split(`### ${row.command}`)[1] ?? '';
      expect(`${row.command}: ${section.includes('node bin/shakerdeck.js ' + row.command)}`).toBe(
        `${row.command}: true`
      );
    }
  });

  it('names no option that the command does not have', () => {
    for (const row of listCommands(buildProgram())) {
      const section = (readme.split(`### ${row.command}`)[1] ?? '').split('###')[0];
      const flags = new Set(
        row.options.flatMap((option) =>
          option.flags.split(/[ ,]+/).filter((part) => part.startsWith('-'))
        )
      );
      for (const match of section.matchAll(/(?:^|\s)(--[a-z][a-z-]*[a-z])(?=[\s`.,]|$)/g)) {
        expect(`${row.command} ${match[1]}: ${flags.has(match[1])}`).toBe(
          `${row.command} ${match[1]}: true`
        );
      }
    }
  });

  it('names every example file that a command line in it passes', () => {
    for (const match of readme.matchAll(/-\w+ (examples\/[a-z0-9-]+\.json)/g)) {
      expect(existsSync(match[1])).toBe(true);
    }
  });

  it('gives each command a section with something in it', () => {
    for (const row of listCommands(buildProgram())) {
      const section = (readme.split(`### ${row.command}\n`)[1] ?? '').split('###')[0];
      expect(`${row.command}: ${section.trim().length > 20}`).toBe(`${row.command}: true`);
    }
  });

  it('keeps the list of what it does in step with the commands it has', () => {
    const opening = readme.split('## Getting started')[0];
    for (const word of ['mud check', 'hydraulics', 'solids control', 'daily mud report']) {
      expect(`${word}: ${opening.includes(word)}`).toBe(`${word}: true`);
    }
  });
});

describe('the getting started block', () => {
  const readme = readFileSync('README.md', 'utf8');

  it('shows the three things a new reader has to run', () => {
    const block = readme.split('## Getting started')[1].split('##')[0];
    for (const line of ['npm install', 'npm test', 'node bin/shakerdeck.js commands']) {
      expect(`${line}: ${block.includes(line)}`).toBe(`${line}: true`);
    }
  });

  it('shows a library example that imports something that exists', async () => {
    const library = await import('../src/index.js');
    const block = readme.split('## Using it as a library')[1].split('##')[0];
    const imports = block.match(/import \{ (.+?) \} from 'shakerdeck'/)[1].split(', ');
    for (const name of imports) {
      expect(`${name}: ${Object.keys(library).includes(name)}`).toBe(`${name}: true`);
    }
  });

  it('calls only functions the library actually exports in that example', async () => {
    const library = await import('../src/index.js');
    const block = readme.split('## Using it as a library')[1].split('##')[0];
    for (const match of block.matchAll(/^([a-z]+)\.([a-zA-Z]+)\(/gm)) {
      const namespace = library[match[1]];
      expect(`${match[1]}.${match[2]}: ${typeof namespace?.[match[2]]}`).toBe(
        `${match[1]}.${match[2]}: function`
      );
    }
  });
});
