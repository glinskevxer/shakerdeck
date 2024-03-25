import { describe, it, expect } from 'vitest';
import {
  measureColumns,
  renderTable,
  table,
  definitionList,
  sideBySide,
} from '../../src/util/table.js';

const columns = [
  { key: 'well', heading: 'well' },
  { key: 'weight', heading: 'ppg', decimals: 1, align: 'right' },
];

const rows = [
  { well: 'brazos 14-3', weight: 12.4 },
  { well: 'ward 2', weight: 9.6 },
];

describe('measureColumns', () => {
  it('takes the width from the widest cell', () => {
    const sized = measureColumns(columns, rows);
    expect(sized[0].width).toBe(11);
  });

  it('takes the heading into account', () => {
    const sized = measureColumns([{ key: 'a', heading: 'a much longer heading' }], [{ a: 'x' }]);
    expect(sized[0].width).toBe(21);
  });

  it('honours a fixed width', () => {
    expect(measureColumns([{ key: 'well', width: 6 }], rows)[0].width).toBe(6);
  });

  it('caps at a maximum', () => {
    const sized = measureColumns([{ key: 'well', maxWidth: 5 }], rows);
    expect(sized[0].width).toBe(5);
  });

  it('never comes out at zero', () => {
    expect(measureColumns([{ key: 'missing' }], [{}])[0].width).toBe(1);
  });
});

describe('renderTable', () => {
  it('prints a heading, a rule and a row for each record', () => {
    const lines = renderTable(columns, rows);
    expect(lines).toEqual([
      'well          ppg',
      '-----------  ----',
      'brazos 14-3  12.4',
      'ward 2        9.6',
    ]);
  });

  it('leaves the heading off when it is not wanted', () => {
    const lines = renderTable(columns, rows, { heading: false });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('brazos 14-3  12.4');
  });

  it('blanks a value that is missing rather than printing a zero', () => {
    const lines = renderTable(columns, [{ well: 'ward 2' }], { heading: false });
    expect(lines[0]).toBe('ward 2');
  });

  it('takes a value function', () => {
    const lines = renderTable(
      [{ heading: 'both', value: (row) => `${row.well} at ${row.weight}` }],
      rows,
      { heading: false }
    );
    expect(lines[0]).toBe('brazos 14-3 at 12.4');
  });

  it('truncates a cell wider than its column', () => {
    const lines = renderTable([{ key: 'well', width: 6 }], rows, { heading: false });
    expect(lines[0]).toBe('brazo~');
  });

  it('prints a number with no decimals set as it stands', () => {
    const lines = renderTable([{ key: 'weight' }], rows, { heading: false });
    expect(lines[0]).toBe('12.4');
  });

  it('uses the blank text a column asks for', () => {
    const lines = renderTable([{ key: 'weight', blank: 'n/t' }], [{}], { heading: false });
    expect(lines[0]).toBe('n/t');
  });

  it('blanks a not a number', () => {
    const lines = renderTable([{ key: 'weight', decimals: 1 }], [{ weight: Number.NaN }], {
      heading: false,
    });
    expect(lines[0]).toBe('');
  });

  it('handles no rows at all', () => {
    expect(renderTable(columns, [])).toHaveLength(2);
    expect(renderTable(columns, null)).toHaveLength(2);
  });
});

describe('table', () => {
  it('joins the lines', () => {
    expect(table(columns, rows).split('\n')).toHaveLength(4);
  });
});

describe('definitionList', () => {
  it('lines the values up past the longest label', () => {
    expect(
      definitionList([
        ['well', 'brazos 14-3'],
        ['depth', 10450],
      ])
    ).toEqual(['well   brazos 14-3', 'depth  10450']);
  });

  it('honours a label width', () => {
    expect(definitionList([['well', 'x']], { labelWidth: 10 })).toEqual(['well        x']);
  });

  it('leaves a missing value blank', () => {
    expect(definitionList([['well', null]])).toEqual(['well']);
  });
});

describe('sideBySide', () => {
  it('lays two blocks out level', () => {
    expect(sideBySide(['aaa', 'b'], ['1', '2'], 2)).toEqual(['aaa  1', 'b    2']);
  });

  it('pads the shorter block out', () => {
    expect(sideBySide(['aaa'], ['1', '2'], 1)).toEqual(['aaa 1', '    2']);
  });

  it('handles an empty right hand block', () => {
    expect(sideBySide(['aaa'], [], 1)).toEqual(['aaa']);
  });
});
