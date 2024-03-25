/**
 * Fixed width tables for the printed report.
 *
 * A column knows its own heading, how to pull its value out of a row, and how
 * wide it wants to be. Widths are worked out from the content when they are
 * not given, because a well name column that is eight characters wide on one
 * rig and thirty on another should not need editing.
 */
import { pad, truncate, rule } from './text.js';

function cellText(column, row) {
  const raw = typeof column.value === 'function' ? column.value(row) : row?.[column.key];
  if (raw === null || raw === undefined) {
    return column.blank ?? '';
  }
  if (typeof raw === 'number') {
    if (Number.isNaN(raw)) {
      return column.blank ?? '';
    }
    return column.decimals === undefined ? String(raw) : raw.toFixed(column.decimals);
  }
  return String(raw);
}

/**
 * Work out the width of each column from its heading and its content.
 */
export function measureColumns(columns, rows) {
  return columns.map((column) => {
    if (column.width) {
      return { ...column, width: column.width };
    }
    const widest = rows.reduce(
      (width, row) => Math.max(width, cellText(column, row).length),
      String(column.heading ?? '').length
    );
    return { ...column, width: Math.max(1, Math.min(widest, column.maxWidth ?? 40)) };
  });
}

/**
 * Render a table as an array of lines.
 */
export function renderTable(columns, rows, options = {}) {
  const gap = options.gap ?? '  ';
  const sized = measureColumns(columns, rows ?? []);
  const lines = [];
  if (options.heading !== false) {
    lines.push(
      sized
        .map((column) =>
          pad(
            truncate(column.heading ?? column.key, column.width),
            column.width,
            column.align === 'right' ? 'right' : 'left'
          )
        )
        .join(gap)
        .trimEnd()
    );
    lines.push(sized.map((column) => rule(column.width)).join(gap));
  }
  for (const row of rows ?? []) {
    lines.push(
      sized
        .map((column) =>
          pad(truncate(cellText(column, row), column.width), column.width, column.align ?? 'left')
        )
        .join(gap)
        .trimEnd()
    );
  }
  return lines;
}

/**
 * Render a table as one block of text.
 */
export function table(columns, rows, options = {}) {
  return renderTable(columns, rows, options).join('\n');
}

/**
 * A two column block for the header of a report, where a list of labelled
 * values reads better than a table.
 */
export function definitionList(pairs, options = {}) {
  const width =
    options.labelWidth ??
    pairs.reduce((widest, pair) => Math.max(widest, String(pair[0]).length), 0);
  return pairs.map(([label, value]) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `${pad(label, width)}  ${text}`.trimEnd();
  });
}

/**
 * Lay two blocks of lines side by side, which is how a mud check sits next to
 * its own limits on the page.
 */
export function sideBySide(left, right, gap = 4) {
  const width = left.reduce((widest, line) => Math.max(widest, line.length), 0);
  const height = Math.max(left.length, right.length);
  const spacer = ' '.repeat(Math.max(0, gap));
  const lines = [];
  for (let i = 0; i < height; i += 1) {
    const a = pad(left[i] ?? '', width);
    const b = right[i] ?? '';
    lines.push(`${a}${spacer}${b}`.trimEnd());
  }
  return lines;
}
