/**
 * Text helpers for the printed report.
 *
 * The daily report goes out as a fixed width page because that is what gets
 * pinned to the wall in the doghouse, so padding and truncation rules live
 * here rather than being spelled out at each call.
 */

export function pad(value, width, align = 'left') {
  const text = value === null || value === undefined ? '' : String(value);
  const size = Math.max(0, Math.trunc(width));
  if (text.length >= size) {
    return text;
  }
  const gap = ' '.repeat(size - text.length);
  if (align === 'right') {
    return gap + text;
  }
  if (align === 'centre') {
    const left = Math.floor((size - text.length) / 2);
    return ' '.repeat(left) + text + ' '.repeat(size - text.length - left);
  }
  return text + gap;
}

/**
 * Cut a value to a width, marking the cut so nobody reads a truncated well
 * name as the whole thing.
 */
export function truncate(value, width) {
  const text = value === null || value === undefined ? '' : String(value);
  const size = Math.max(0, Math.trunc(width));
  if (text.length <= size) {
    return text;
  }
  if (size <= 1) {
    return text.slice(0, size);
  }
  return `${text.slice(0, size - 1)}~`;
}

/**
 * Wrap a paragraph at a width, breaking on spaces and never mid word unless a
 * single word is longer than the line.
 */
export function wrap(text, width = 78) {
  const size = Math.max(1, Math.trunc(width));
  const words = String(text ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line === '') {
      line = word;
    } else if (line.length + 1 + word.length <= size) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
    while (line.length > size) {
      lines.push(line.slice(0, size));
      line = line.slice(size);
    }
  }
  if (line !== '') {
    lines.push(line);
  }
  return lines;
}

/**
 * Title case a heading without touching the words a driller writes in caps.
 */
export function heading(text) {
  return String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * A rule across the page.
 */
export function rule(width = 78, character = '-') {
  const size = Math.max(0, Math.trunc(width));
  return character.repeat(size);
}

/**
 * Turn a decimal into a fixed width number for a column, blanking a value
 * that is not there rather than printing a zero.
 */
export function numberCell(value, decimals = 2, width = 8) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return pad('', width, 'right');
  }
  if (typeof value !== 'number') {
    return pad(String(value), width, 'right');
  }
  return pad(value.toFixed(decimals), width, 'right');
}

/**
 * Join a list into an English phrase, which reads better in an exception line
 * than a comma separated dump.
 */
export function listPhrase(items) {
  const rows = (items ?? []).map((item) => String(item)).filter((item) => item !== '');
  if (rows.length === 0) {
    return '';
  }
  if (rows.length === 1) {
    return rows[0];
  }
  return `${rows.slice(0, -1).join(', ')} and ${rows.at(-1)}`;
}

/**
 * A short slug for a file name, taken off a well or a report title.
 */
export function slug(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
