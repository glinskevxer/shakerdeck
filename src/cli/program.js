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
import { hydraulicsCommand } from './commands/hydraulics.js';
import { dailyCommand } from './commands/daily.js';
import { mixCommand } from './commands/mix.js';
import { programmeCommand } from './commands/programme.js';
import { solidsCommand } from './commands/solids.js';
import { stockCommand } from './commands/stock.js';
import { commandsCommand } from './commands/commands.js';
import { recapCommand } from './commands/recap.js';
import { exportCommand } from './commands/export.js';
import { pitsCommand } from './commands/pits.js';
import { killCommand } from './commands/kill.js';
import { tripCommand } from './commands/trip.js';
import { doctorCommand } from './commands/doctor.js';

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

  program
    .command('hydraulics')
    .description('work the circulating system out for a well at a rate')
    .requiredOption('-w, --well <file>', 'the well as json')
    .requiredOption('-c, --check <file>', 'the mud check as json')
    .option('-r, --rate <gpm>', 'override the rate on the well file')
    .option('-f, --format <format>', 'text or json', 'text')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .action((options) => {
      const well = readJson(options.well);
      if (options.rate !== undefined) {
        well.flowGpm = Number(options.rate);
      }
      const result = hydraulicsCommand(well, readJson(options.check));
      print(output(result, options));
    });

  program
    .command('daily')
    .description('build the daily mud report for one day on one well')
    .requiredOption('-d, --day <file>', "the day's records as json")
    .requiredOption('-c, --check <file>', 'the mud check as json')
    .option('-p, --programme <file>', 'the mud programme as json')
    .option('-P, --products <file>', 'the price list as json')
    .option('-f, --format <format>', 'text or json', 'text')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .option('--summary', 'print the one line summary instead of the page')
    .action((options) => {
      const result = dailyCommand({
        day: readJson(options.day),
        check: readJson(options.check),
        programme: options.programme ? readJson(options.programme) : null,
        products: options.products ? readJson(options.products) : null,
      });
      if (options.summary) {
        print(result.summary);
        return;
      }
      print(output(result, options));
    });

  program
    .command('mix')
    .description('work out a mixing order to move the mud where it needs to go')
    .requiredOption('-j, --job <job>', 'weight up, cut back, blend or dilute')
    .option('--from <ppg>', 'the weight the mud is at now')
    .option('--to <ppg>', 'the weight it needs to be')
    .requiredOption('-v, --volume <bbl>', 'the volume of the system')
    .option('-a, --agent <agent>', 'the weighting agent', 'barite')
    .option('--hold-volume', 'dump mud first so the system ends the size it started')
    .option('--dilutant <ppg>', 'the weight of what is being cut back with')
    .option('--heavy <ppg>', 'the weight of the heavy mud, for a blend')
    .option('--from-solids <fraction>', 'the solids fraction now, for a dilution')
    .option('--to-solids <fraction>', 'the solids fraction wanted, for a dilution')
    .option('-f, --format <format>', 'text or json', 'text')
    .action((options) => {
      const result = mixCommand({
        job: options.job,
        fromPpg: options.from === undefined ? undefined : Number(options.from),
        toPpg: options.to === undefined ? undefined : Number(options.to),
        volumeBbl: Number(options.volume),
        agent: options.agent,
        holdVolume: Boolean(options.holdVolume),
        dilutantPpg: options.dilutant === undefined ? null : Number(options.dilutant),
        heavyPpg: options.heavy === undefined ? null : Number(options.heavy),
        fromFraction: options.fromSolids === undefined ? null : Number(options.fromSolids),
        toFraction: options.toSolids === undefined ? null : Number(options.toSolids),
      });
      print(output(result, options));
    });

  program
    .command('programme')
    .description('print the mud programme, plan a section, or judge checks against it')
    .requiredOption('-p, --programme <file>', 'the mud programme as json')
    .option('-c, --checks <file>', 'a run of mud checks to judge against it')
    .option('-s, --section <name>', 'plan this section')
    .option('-t, --treatments <file>', 'treatment rates per barrel, for a plan')
    .option('-P, --products <file>', 'the price list, for a plan')
    .option('--system <bbl>', 'the surface system volume, for a plan', '500')
    .option('-f, --format <format>', 'text or json', 'text')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .action((options) => {
      const result = programmeCommand({
        programme: readJson(options.programme),
        checks: options.checks ? readJson(options.checks) : null,
        plan: options.section
          ? {
              section: options.section,
              treatments: readJson(options.treatments),
              products: readJson(options.products),
              surfaceSystemBbl: Number(options.system),
            }
          : null,
      });
      print(output(result, options));
    });

  program
    .command('solids')
    .description('run the solids control spread over a day of cuttings')
    .requiredOption('-s, --spread <file>', 'the solids control spread as json')
    .option('-f, --format <format>', 'text or json', 'text')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .action((options) => {
      print(output(solidsCommand(readJson(options.spread)), options));
    });

  program
    .command('stock')
    .description('run the product movements and report what needs ordering')
    .requiredOption('-P, --products <file>', 'the price list as json')
    .requiredOption('-m, --movements <file>', 'the movements as json')
    .option('-b, --opening <file>', 'the opening stock as json')
    .option('--lead <days>', 'lead time from the yard in days', '3')
    .option('--cover <days>', 'days of cover to order up to', '14')
    .option('-f, --format <format>', 'text or json', 'text')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .action((options) => {
      const result = stockCommand({
        products: readJson(options.products),
        movements: readJson(options.movements),
        opening: options.opening ? readJson(options.opening) : {},
        leadTimeDays: Number(options.lead),
        coverDays: Number(options.cover),
      });
      print(output(result, options));
    });

  program
    .command('commands')
    .description('list every command this tool carries')
    .option('-v, --verbose', 'list the options of each command as well')
    .option('-f, --format <format>', 'text or json', 'text')
    .action((options) => {
      print(output(commandsCommand(program, { verbose: Boolean(options.verbose) }), options));
    });

  program
    .command('recap')
    .description('write the end of well recap off every check and every day')
    .requiredOption('-c, --checks <file>', 'the run of mud checks as json')
    .option('-w, --well <name>', 'the well name for the heading')
    .option('-p, --programme <file>', 'the mud programme as json')
    .option('-d, --days <file>', 'the daily records as json')
    .option('-P, --products <file>', 'the price list as json')
    .option('-f, --format <format>', 'text or json', 'text')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .action((options) => {
      const checks = readJson(options.checks);
      const result = recapCommand({
        well: options.well ?? checks[0]?.well ?? 'the well',
        checks,
        programme: options.programme ? readJson(options.programme) : null,
        days: options.days ? readJson(options.days) : null,
        products: options.products ? readJson(options.products) : null,
      });
      print(output(result, options));
    });

  program
    .command('export')
    .description('write a table out as a comma separated file')
    .requiredOption('-t, --table <table>', 'checks, days or stock')
    .requiredOption('-i, --input <file>', 'the records to write out')
    .option('-P, --products <file>', 'the price list, for days and stock')
    .option('-b, --opening <file>', 'the opening stock, for stock')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .action((options) => {
      const result = exportCommand({
        table: options.table,
        input: readJson(options.input),
        products: options.products ? readJson(options.products) : null,
        opening: options.opening ? readJson(options.opening) : {},
      });
      if (options.out) {
        writeText(options.out, result.data);
        print(`written to ${options.out}`);
        return;
      }
      print(result.lines.join('\n'));
    });

  program
    .command('pits')
    .description('total the active system over a tour and read the changes')
    .requiredOption('-p, --pits <file>', 'the tanks and the level readings as json')
    .option('--threshold <bbl>', 'the change worth flagging')
    .option('-f, --format <format>', 'text or json', 'text')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .action((options) => {
      const input = readJson(options.pits);
      if (options.threshold !== undefined) {
        input.thresholdBbl = Number(options.threshold);
      }
      print(output(pitsCommand(input), options));
    });

  program
    .command('kill')
    .description('work the mud side of a kill sheet and the mud to build for it')
    .requiredOption('-k, --kill <file>', 'the shut in readings as json')
    .option('--system <bbl>', 'the system volume, to work the barite out')
    .option('-a, --agent <agent>', 'the weighting agent', 'barite')
    .option('-f, --format <format>', 'text or json', 'text')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .action((options) => {
      const input = readJson(options.kill);
      if (options.system !== undefined) {
        input.systemBbl = Number(options.system);
      }
      input.agent = options.agent;
      print(output(killCommand(input), options));
    });

  program
    .command('trip')
    .description('run a trip sheet stand by stand against what the hole should take')
    .requiredOption('-t, --trip <file>', 'the trip sheet as json')
    .option('--threshold <bbl>', 'the running difference worth flagging')
    .option('-f, --format <format>', 'text or json', 'text')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .action((options) => {
      const input = readJson(options.trip);
      if (options.threshold !== undefined) {
        input.thresholdBbl = Number(options.threshold);
      }
      print(output(tripCommand(input), options));
    });

  program
    .command('doctor')
    .description('read the whole set of files together and report where they disagree')
    .option('-w, --well <file>', 'the well as json')
    .option('-c, --checks <file>', 'the run of mud checks as json')
    .option('-p, --programme <file>', 'the mud programme as json')
    .option('-P, --products <file>', 'the price list as json')
    .option('-m, --movements <file>', 'the product movements as json')
    .option('-d, --days <file>', 'the daily records as json')
    .option('-f, --format <format>', 'text or json', 'text')
    .option('-o, --out <file>', 'write to a file instead of the screen')
    .action((options) => {
      print(
        output(
          doctorCommand({
            well: options.well ? readJson(options.well) : null,
            checks: options.checks ? readJson(options.checks) : null,
            programme: options.programme ? readJson(options.programme) : null,
            products: options.products ? readJson(options.products) : null,
            movements: options.movements ? readJson(options.movements) : null,
            days: options.days ? readJson(options.days) : null,
          }),
          options
        )
      );
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
