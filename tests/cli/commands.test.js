import { describe, it, expect } from 'vitest';
import { buildProgram, run } from '../../src/cli/program.js';
import { listCommands, renderCommands, commandsCommand } from '../../src/cli/commands/commands.js';

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

const rows = listCommands(buildProgram());

describe('listCommands', () => {
  it('finds every command on the program', () => {
    expect(rows.length).toBeGreaterThanOrEqual(7);
    expect(rows.map((row) => row.command)).toContain('check');
    expect(rows.map((row) => row.command)).toContain('commands');
  });

  it('reports them in alphabetical order', () => {
    const names = rows.map((row) => row.command);
    expect(names).toEqual([...names].sort());
  });

  it('leaves the built in help option out', () => {
    for (const row of rows) {
      expect(row.options.map((option) => option.flags)).not.toContain('-h, --help');
    }
  });

  it('marks the options that have to be given', () => {
    const check = rows.find((row) => row.command === 'check');
    expect(check.options.find((option) => option.flags.includes('--check')).required).toBe(true);
  });
});

describe('every command describes itself', () => {
  it('has a description worth reading', () => {
    for (const row of rows) {
      expect(row.description.length).toBeGreaterThan(15);
    }
  });

  it('describes every option it takes', () => {
    for (const row of rows) {
      for (const option of row.options) {
        expect(`${row.command} ${option.flags}: ${option.description ?? ''}`).toMatch(/: .{4,}/);
      }
    }
  });

  it('offers a format option wherever it prints a report', () => {
    // mix takes its inputs as flags rather than a file, and export writes one
    // format only, so neither of them has anything to switch between.
    const reporting = rows.filter((row) => row.command !== 'mix' && row.command !== 'export');
    for (const row of reporting) {
      expect(row.options.map((option) => option.flags).join(' ')).toContain('--format');
    }
  });
});

describe('renderCommands', () => {
  it('tables the commands', () => {
    const text = renderCommands(rows).join('\n');
    expect(text).toContain('SHAKERDECK COMMANDS');
    expect(text).toContain('hydraulics');
  });

  it('lists the options when asked', () => {
    const text = renderCommands(rows, { verbose: true }).join('\n');
    expect(text).toContain('--check <file>');
    expect(text).toContain('(required)');
  });
});

describe('the command', () => {
  it('runs from the command line', async () => {
    const io = capture();
    expect(await run(['commands'], io)).toBe(0);
    expect(io.out.join('\n')).toContain('SHAKERDECK COMMANDS');
  });

  it('prints json when asked', async () => {
    const io = capture();
    await run(['commands', '-f', 'json'], io);
    const parsed = JSON.parse(io.out[0]);
    expect(parsed.length).toBe(rows.length);
  });

  it('returns the same rows it prints', () => {
    expect(commandsCommand(buildProgram()).data).toEqual(rows);
  });
});
