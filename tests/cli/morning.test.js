import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readMorning, morningCommand } from '../../src/cli/commands/morning.js';
import { run } from '../../src/cli/program.js';

const checks = JSON.parse(readFileSync('examples/checks-brazos.json', 'utf8'));
const programme = JSON.parse(readFileSync('examples/programme-brazos.json', 'utf8'));

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

describe('readMorning', () => {
  const data = readMorning({ checks, programme });

  it('reports on the last check in the run', () => {
    expect(data.date).toBe(checks.at(-1).date);
    expect(data.depthFeet).toBe(checks.at(-1).depthFeet);
  });

  it('compares it against the one before', () => {
    expect(data.madeFeet).toBe(checks.at(-1).depthFeet - checks.at(-2).depthFeet);
  });

  it('takes the well name off the check when none is given', () => {
    expect(data.well).toBe('brazos 14-3');
  });

  it('takes a well name when one is', () => {
    expect(readMorning({ well: 'ward 2', checks }).well).toBe('ward 2');
  });

  it('runs on a single check with nothing to compare against', () => {
    const first = readMorning({ checks: [checks[0]] });
    expect(first.madeFeet).toBe(null);
  });

  it('refuses a run with no checks in it', () => {
    expect(() => readMorning({ checks: [] })).toThrow(/at least one check/);
  });

  it('carries the activity line through', () => {
    expect(readMorning({ checks, activity: 'tripping for a bit' }).activity).toBe(
      'tripping for a bit'
    );
  });
});

describe('morningCommand', () => {
  it('returns the four lines and the subject', () => {
    const result = morningCommand({ checks, programme });
    expect(result.lines).toHaveLength(4);
    expect(result.subject).toContain('brazos 14-3');
  });

  it('runs from the command line', async () => {
    const io = capture();
    const code = await run(
      ['morning', '-c', 'examples/checks-brazos.json', '-p', 'examples/programme-brazos.json'],
      io
    );
    expect(code).toBe(0);
    expect(io.out.join('\n').split('\n')).toHaveLength(4);
  });

  it('prints the subject line when asked', async () => {
    const io = capture();
    await run(['morning', '-c', 'examples/checks-brazos.json', '--subject'], io);
    expect(io.out).toHaveLength(1);
    expect(io.out[0]).toMatch(/10450 ft/);
  });

  it('takes an activity line off the command line', async () => {
    const io = capture();
    await run(
      ['morning', '-c', 'examples/checks-brazos.json', '-a', 'tripping for a bit', '-f', 'json'],
      io
    );
    expect(JSON.parse(io.out[0]).activity).toBe('tripping for a bit');
  });
});
