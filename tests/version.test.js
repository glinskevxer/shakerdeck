import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { VERSION, readVersion } from '../src/version.js';

describe('the version', () => {
  it('is read off the manifest rather than typed twice', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(VERSION).toBe(manifest.version);
    expect(readVersion()).toBe(manifest.version);
  });

  it('looks like a version', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('reads the same every time it is asked', () => {
    expect(readVersion()).toBe(readVersion());
  });

  it('is what the command line prints', async () => {
    const { buildProgram } = await import('../src/cli/program.js');
    expect(buildProgram().version()).toBe(VERSION);
  });
});
