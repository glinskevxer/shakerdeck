/**
 * Comma separated reading and writing.
 *
 * The client's engineering group wants the month's checks as a spreadsheet and
 * the rig sends its pit readings the same way, so this goes both directions.
 * Quoting follows the usual rule: a field is quoted when it holds a comma, a
 * quote or a line break, and a quote inside a quoted field is doubled.
 */

function needsQuoting(text) {
  return /[",\r\n]/.test(text);
}

export function escapeField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (!needsQuoting(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Write one row.
 */
export function writeRow(values) {
  return values.map(escapeField).join(',');
}

/**
 * Write a whole table from a list of columns and a list of records.
 */
export function writeCsv(columns, rows) {
  const lines = [writeRow(columns.map((column) => column.heading ?? column.key))];
  for (const row of rows ?? []) {
    lines.push(
      writeRow(
        columns.map((column) => {
          const raw = typeof column.value === 'function' ? column.value(row) : row?.[column.key];
          if (typeof raw === 'number' && column.decimals !== undefined) {
            return Number.isFinite(raw) ? raw.toFixed(column.decimals) : '';
          }
          return raw;
        })
      )
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Split one line into fields, honouring quotes.
 */
export function parseRow(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];
    if (quoted) {
      if (character === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      fields.push(field);
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) {
    throw new Error('the line ends inside a quoted field');
  }
  fields.push(field);
  return fields;
}

/**
 * Read a whole file into records keyed by the header row.
 */
export function readCsv(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    return [];
  }
  const headers = parseRow(lines[0]).map((header) => header.trim());
  const records = [];
  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseRow(lines[i]);
    if (fields.length !== headers.length) {
      throw new Error(
        `line ${i + 1} has ${fields.length} fields where the header has ${headers.length}`
      );
    }
    const record = {};
    headers.forEach((header, index) => {
      record[header] = fields[index];
    });
    records.push(record);
  }
  return records;
}
