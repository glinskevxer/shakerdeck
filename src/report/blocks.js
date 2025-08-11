/**
 * The blocks every report page is built from.
 *
 * Five renderers were each writing the same three lines to open a block: a
 * blank, a heading, and a definition list with the empty rows filtered out.
 * Two of them had forgotten the filter, so a reading that was never taken
 * printed as a blank value under a label rather than being left off the page.
 */
import { heading, rule } from '../util/text.js';
import { definitionList, table } from '../util/table.js';

/**
 * A page heading with a rule under it.
 */
export function title(text, width = 70) {
  return [heading(text), rule(width)];
}

/**
 * A labelled block, with anything that was not measured left out.
 */
export function block(name, pairs) {
  const rows = pairs.filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (rows.length === 0) {
    return [];
  }
  return ['', heading(name), ...definitionList(rows)];
}

/**
 * The same, without the leading blank, for the block that opens a page.
 */
export function firstBlock(pairs) {
  const rows = pairs.filter(([, value]) => value !== null && value !== undefined && value !== '');
  return definitionList(rows);
}

/**
 * A block that is a table rather than a list, left off when it is empty.
 */
export function tableBlock(name, columns, rows) {
  if (!rows || rows.length === 0) {
    return [];
  }
  return ['', heading(name), table(columns, rows)];
}

/**
 * A block of free lines, indented, left off when there are none.
 */
export function listBlock(name, lines) {
  if (!lines || lines.length === 0) {
    return [];
  }
  return ['', heading(name), ...lines.map((line) => `  ${line}`)];
}
