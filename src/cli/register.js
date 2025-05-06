/**
 * Registering the commands.
 *
 * The program file had grown to over four hundred lines and most of it was
 * these blocks, which are all the same shape and none of which have anything
 * to do with how the program is built or run. They live here so both files
 * stay a size somebody will read.
 */
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
import { morningCommand } from './commands/morning.js';
import { sectionCommand } from './commands/section.js';
import { readJson, writeText } from './io.js';

/**
 * The commands that print a report, and so take the format and the out file.
 *
 * mix and export are not on the list: mix takes its inputs as flags rather
 * than a file, and export writes one format only, so neither of them has
 * anything to switch between.
 */
export const REPORTING_COMMANDS = [
  'check',
  'hydraulics',
  'daily',
  'programme',
  'solids',
  'stock',
  'recap',
  'pits',
  'kill',
  'trip',
  'doctor',
  'morning',
  'section',
];

/**
 * Add the two options every reporting command carries.
 *
 * Each command used to carry its own copy of these two lines and they had
 * already drifted: the wording of the format option was not the same in every
 * one of them, so the help read differently depending on which command was
 * asked.
 */
export function addReportingOptions(program) {
  for (const command of program.commands) {
    if (!REPORTING_COMMANDS.includes(command.name())) {
      continue;
    }
    command
      .option('-f, --format <format>', 'text or json', 'text')
      .option('-o, --out <file>', 'write to a file instead of the screen');
  }
  return program;
}

/**
 * Register every command on a program.
 */
export function registerCommands(program, { print, output }) {
  program
    .command('check')
    .description('read a mud check sheet and print what it says')
    .requiredOption('-c, --check <file>', 'the mud check as json')
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

  program
    .command('morning')
    .description('write the four line morning report off the last two checks')
    .requiredOption('-c, --checks <file>', 'the run of mud checks as json')
    .option('-w, --well <name>', 'the well name')
    .option('-p, --programme <file>', 'the mud programme as json')
    .option('-a, --activity <text>', 'one line on what the rig is doing')
    .option('--subject', 'print the subject line instead of the report')
    .action((options) => {
      const result = morningCommand({
        well: options.well,
        checks: readJson(options.checks),
        programme: options.programme ? readJson(options.programme) : null,
        activity: options.activity ?? null,
      });
      if (options.subject) {
        print(result.subject);
        return;
      }
      print(output(result, options));
    });

  program
    .command('section')
    .description('report what one hole section actually took, against its plan')
    .requiredOption('-s, --section <name>', 'the section in the programme')
    .requiredOption('-c, --checks <file>', 'the run of mud checks as json')
    .requiredOption('-p, --programme <file>', 'the mud programme as json')
    .option('-d, --days <file>', 'the daily records as json')
    .option('-P, --products <file>', 'the price list as json')
    .option('-t, --treatments <file>', 'treatment rates, to compare against the plan')
    .option('--system <bbl>', 'the surface system volume, for the plan', '500')
    .action((options) => {
      print(
        output(
          sectionCommand({
            name: options.section,
            checks: readJson(options.checks),
            programme: readJson(options.programme),
            days: options.days ? readJson(options.days) : null,
            products: options.products ? readJson(options.products) : null,
            treatments: options.treatments ? readJson(options.treatments) : null,
            surfaceSystemBbl: Number(options.system),
          }),
          options
        )
      );
    });

  return addReportingOptions(program);
}
