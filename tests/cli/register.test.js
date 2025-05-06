import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import {
  registerCommands,
  addReportingOptions,
  REPORTING_COMMANDS,
} from '../../src/cli/register.js';
import { buildProgram } from '../../src/cli/program.js';

function bare() {
  const program = new Command();
  program.name('shakerdeck');
  return program;
}

describe('registerCommands', () => {
  it('puts every command on a bare program', () => {
    const program = registerCommands(bare(), { print: () => {}, output: () => '' });
    expect(program.commands.length).toBeGreaterThanOrEqual(15);
  });

  it('registers the same commands the built program has', () => {
    const registered = registerCommands(bare(), { print: () => {}, output: () => '' })
      .commands.map((command) => command.name())
      .sort();
    const built = buildProgram()
      .commands.map((command) => command.name())
      .sort();
    expect(registered).toEqual(built);
  });

  it('gives every command a description', () => {
    for (const command of registerCommands(bare(), { print: () => {}, output: () => '' })
      .commands) {
      expect(`${command.name()}: ${command.description().length > 15}`).toBe(
        `${command.name()}: true`
      );
    }
  });
});

describe('addReportingOptions', () => {
  it('adds the two options to every reporting command', () => {
    const program = registerCommands(bare(), { print: () => {}, output: () => '' });
    for (const command of program.commands) {
      const flags = command.options.map((option) => option.flags).join(' ');
      if (REPORTING_COMMANDS.includes(command.name())) {
        expect(`${command.name()}: ${flags}`).toContain('--format');
        expect(`${command.name()}: ${flags}`).toContain('--out');
      }
    }
  });

  it('leaves the other commands alone', () => {
    const program = buildProgram();
    const mix = program.commands.find((command) => command.name() === 'mix');
    expect(mix.options.map((option) => option.flags).join(' ')).not.toContain('--out');
  });

  it('does not add them twice', () => {
    const program = addReportingOptions(bare());
    expect(program.commands).toEqual([]);
  });

  it('names every reporting command that actually exists', () => {
    const names = buildProgram().commands.map((command) => command.name());
    for (const name of REPORTING_COMMANDS) {
      expect(names).toContain(name);
    }
  });
});
