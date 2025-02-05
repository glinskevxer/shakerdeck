import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJson, writeText, render, UsageError } from '../../src/cli/io.js';

describe('readJson', () => {
  it('reads a file', () => {
    expect(readJson('examples/check-brazos.json').well).toBe('brazos 14-3');
  });

  it('names a file that is not there', () => {
    expect(() => readJson('examples/nowhere.json')).toThrow(/there is no file at/);
  });

  it('names a directory given where a file was wanted', () => {
    expect(() => readJson('examples')).toThrow(/is a directory, not a file/);
  });

  it('names a file that will not parse', () => {
    const dir = mkdtempSync(join(tmpdir(), 'shakerdeck-io-'));
    const path = join(dir, 'broken.json');
    writeFileSync(path, '{ "well": ');
    expect(() => readJson(path)).toThrow(/is not valid json/);
  });

  it('names a file it has no permission to read', () => {
    const dir = mkdtempSync(join(tmpdir(), 'shakerdeck-io-'));
    const path = join(dir, 'closed.json');
    writeFileSync(path, '{}');
    chmodSync(path, 0o000);
    try {
      expect(() => readJson(path)).toThrow(/could not be read/);
    } finally {
      chmodSync(path, 0o600);
    }
  });

  it('refuses no path at all', () => {
    expect(() => readJson('')).toThrow(/no file was given/);
    expect(() => readJson(undefined)).toThrow(UsageError);
  });

  it('throws a usage error rather than a bare one', () => {
    try {
      readJson('examples/nowhere.json');
    } catch (error) {
      expect(error).toBeInstanceOf(UsageError);
      expect(error.name).toBe('UsageError');
    }
  });
});

describe('writeText', () => {
  it('writes a file and hands the path back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'shakerdeck-io-'));
    const path = join(dir, 'page.txt');
    expect(writeText(path, 'a page')).toBe(path);
    expect(readFileSync(path, 'utf8')).toBe('a page');
  });

  it('overwrites what was there', () => {
    const dir = mkdtempSync(join(tmpdir(), 'shakerdeck-io-'));
    const path = join(dir, 'page.txt');
    writeText(path, 'first');
    writeText(path, 'second');
    expect(readFileSync(path, 'utf8')).toBe('second');
  });

  it('names a path it cannot write', () => {
    expect(() => writeText('/nowhere/at/all/page.txt', 'x')).toThrow(/could not be written/);
  });
});

describe('render', () => {
  it('joins the lines for a page', () => {
    expect(render({ lines: ['one', 'two'] })).toBe('one\ntwo');
  });

  it('writes the data as json when asked', () => {
    expect(JSON.parse(render({ lines: ['one'], data: { a: 1 } }, { format: 'json' }))).toEqual({
      a: 1,
    });
  });

  it('falls back to the whole result when there is no data field', () => {
    expect(JSON.parse(render({ lines: ['one'] }, { format: 'json' })).lines).toEqual(['one']);
  });

  it('stringifies anything that is neither', () => {
    expect(render('plain')).toBe('plain');
    expect(render(42)).toBe('42');
  });
});
