/**
 * The commands command.
 *
 * A rig laptop has no internet and the readme is not on it, so the tool has to
 * be able to say what it can do. The listing is read off the program itself
 * rather than kept in a table beside it, because a table beside it goes stale
 * the first time somebody adds a command in a hurry.
 */
import { table } from '../../util/table.js';
import { heading, rule } from '../../util/text.js';

/**
 * Read every command off a built program.
 */
export function listCommands(program) {
  return program.commands
    .map((command) => ({
      command: command.name(),
      description: command.description(),
      options: command.options
        .filter((option) => option.long !== '--help')
        .map((option) => ({
          flags: option.flags,
          description: option.description,
          required: Boolean(option.required || option.mandatory),
        })),
    }))
    .sort((a, b) => a.command.localeCompare(b.command));
}

/**
 * Lay the listing out.
 */
export function renderCommands(rows, { verbose = false } = {}) {
  const lines = [
    heading('shakerdeck commands'),
    rule(70),
    table(
      [
        { key: 'command', heading: 'command' },
        { key: 'description', heading: 'what it does' },
      ],
      rows,
      { gap: '   ' }
    ),
  ];
  if (!verbose) {
    return lines;
  }
  for (const row of rows) {
    lines.push('', heading(row.command));
    for (const option of row.options) {
      lines.push(`  ${option.flags}${option.required ? ' (required)' : ''}`);
      lines.push(`      ${option.description}`);
    }
  }
  return lines;
}

export function commandsCommand(program, options = {}) {
  const rows = listCommands(program);
  return { data: rows, lines: renderCommands(rows, options) };
}
