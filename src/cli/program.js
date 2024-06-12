/**
 * The command line.
 *
 * Every command reads json files, works one thing out and prints it either as
 * a page or as json. Nothing here holds state and nothing writes unless it was
 * asked to, so a command can be run against a file on a rig laptop without
 * anybody worrying about what it might touch.
 */
import { Command } from 'commander';
import { VERSION } from '../version.js';
import { readJson, render, writeText, UsageError } from './io.js';
import { checkCommand } from './commands/check.js';

function output(result, options) {
  const text = render(result, options);
  if (options.out) {
    writeText(options.out, `${text}\n`);
    return `written to ${options.out}`;
  }
  return text;
}

/**
 * Build the program. The print function is injected so the tests can drive
 * every command without capturing standard output.
 */
export function buildProgram({ print = console.log } = {}) {
  const program = new Command();
  program
    .name('shakerdeck')
    .description('mud check, hydraulics and material balance for a drilling fluids service')
    .version(VERSION)
    .showHelpAfterError();

  program
    .command('check')
    .description('read a mud check sheet and print what it says')
    .requiredOption('-c, --check <file>', 'the mud check as json')
    .option('-f, --format <format>', 'text or json', 'text')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .action((options) => {
      const result = checkCommand(readJson(options.check));
      print(output(result, options));
    });

  return program;
}

/**
 * Run the program, turning a usage error into one line and an exit code.
 */
export async function run(argv, { print = console.log, fail = console.error } = {}) {
  const program = buildProgram({ print });
  // exitOverride has to go on every command, not just the top one. Without it
  // a missing option on a subcommand calls process.exit straight out of
  // commander and the caller never sees the code.
  program.exitOverride();
  for (const command of program.commands) {
    command.exitOverride();
  }
  try {
    await program.parseAsync(argv, { from: 'user' });
    return 0;
  } catch (error) {
    if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
      return 0;
    }
    if (error.code === 'commander.help') {
      return 0;
    }
    if (error instanceof UsageError) {
      fail(error.message);
      return 2;
    }
    if (error.name === 'SchemaError' || error.name === 'ValueError') {
      fail(error.message);
      return 2;
    }
    if (error.code && String(error.code).startsWith('commander.')) {
      fail(error.message);
      return 2;
    }
    fail(error.message);
    return 1;
  }
}
