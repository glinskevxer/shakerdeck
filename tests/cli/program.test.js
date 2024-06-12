import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, buildProgram } from '../../src/cli/program.js';
import { readJson, render, writeText, UsageError } from '../../src/cli/io.js';
import { VERSION } from '../../src/version.js';

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

describe('readJson', () => {
  it('reads a file', () => {
    expect(readJson('examples/check-brazos.json').well).toBe('brazos 14-3');
  });

  it('names a file that is not there', () => {
    expect(() => readJson('examples/nowhere.json')).toThrow(/there is no file at/);
  });

  it('names a directory given where a file was wanted', () => {
    expect(() => readJson('examples')).toThrow(/is a directory/);
  });

  it('names a file that is not json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'shakerdeck-'));
    const path = join(dir, 'broken.json');
    writeFileSync(path, '{ not json');
    expect(() => readJson(path)).toThrow(/is not valid json/);
  });

  it('refuses no file at all', () => {
    expect(() => readJson('')).toThrow(/no file was given/);
    expect(() => readJson(null)).toThrow(UsageError);
  });
});

describe('writeText and render', () => {
  it('writes a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'shakerdeck-'));
    const path = join(dir, 'out.txt');
    writeText(path, 'hello');
    expect(readFileSync(path, 'utf8')).toBe('hello');
  });

  it('names a path it cannot write', () => {
    expect(() => writeText('/nowhere/at/all/out.txt', 'x')).toThrow(/could not be written/);
  });

  it('renders lines as text and data as json', () => {
    const result = { lines: ['a', 'b'], data: { a: 1 } };
    expect(render(result)).toBe('a\nb');
    expect(JSON.parse(render(result, { format: 'json' }))).toEqual({ a: 1 });
  });

  it('renders a bare value', () => {
    expect(render('plain')).toBe('plain');
  });
});

describe('run', () => {
  it('runs the check command', async () => {
    const io = capture();
    const code = await run(['check', '-c', 'examples/check-brazos.json'], io);
    expect(code).toBe(0);
    expect(io.out.join('\n')).toContain('MUD CHECK BRAZOS 14-3');
  });

  it('prints json when asked', async () => {
    const io = capture();
    await run(['check', '-c', 'examples/check-brazos.json', '-f', 'json'], io);
    expect(JSON.parse(io.out[0]).well).toBe('brazos 14-3');
  });

  it('writes to a file when asked', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'shakerdeck-'));
    const path = join(dir, 'check.txt');
    const io = capture();
    await run(['check', '-c', 'examples/check-brazos.json', '-o', path], io);
    expect(io.out[0]).toBe(`written to ${path}`);
    expect(readFileSync(path, 'utf8')).toContain('MUD CHECK');
  });

  it('leaves with two on a file that is not there', async () => {
    const io = capture();
    const code = await run(['check', '-c', 'examples/nowhere.json'], io);
    expect(code).toBe(2);
    expect(io.err[0]).toMatch(/there is no file at/);
  });

  it('leaves with two on a sheet that will not read', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'shakerdeck-'));
    const path = join(dir, 'bad.json');
    writeFileSync(path, JSON.stringify({ well: 'x', date: '2024-01-01', depthFeet: 1 }));
    const io = capture();
    const code = await run(['check', '-c', path], io);
    expect(code).toBe(2);
    expect(io.err[0]).toMatch(/weightPpg/);
  });

  it('leaves with two when a required option is missing', async () => {
    const io = capture();
    const code = await run(['check'], io);
    expect(code).toBe(2);
    expect(io.err.join('\n')).toMatch(/--check/);
  });

  it('leaves with two on a command it does not know', async () => {
    const io = capture();
    expect(await run(['nonsense'], io)).toBe(2);
  });

  it('prints its version', async () => {
    const io = capture();
    expect(await run(['--version'], io)).toBe(0);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('buildProgram', () => {
  it('names itself', () => {
    expect(buildProgram().name()).toBe('shakerdeck');
  });

  it('registers the commands', () => {
    expect(buildProgram().commands.map((command) => command.name())).toContain('check');
  });
});
