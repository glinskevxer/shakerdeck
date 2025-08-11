import { describe, it, expect } from 'vitest';
import { title, block, firstBlock, tableBlock, listBlock } from '../../src/report/blocks.js';

describe('title', () => {
  it('is a heading with a rule under it', () => {
    expect(title('daily mud report', 20)).toEqual(['DAILY MUD REPORT', '--------------------']);
  });

  it('defaults to the page width', () => {
    expect(title('x')[1]).toHaveLength(70);
  });
});

describe('block', () => {
  it('opens with a blank and a heading', () => {
    const lines = block('density', [['weight', '12.4 ppg']]);
    expect(lines[0]).toBe('');
    expect(lines[1]).toBe('DENSITY');
  });

  it('leaves out a row that was never measured', () => {
    const lines = block('density', [
      ['weight', '12.4 ppg'],
      ['funnel', null],
      ['temperature', undefined],
      ['ph', ''],
    ]);
    expect(lines).toHaveLength(3);
    expect(lines.join('\n')).not.toContain('funnel');
  });

  it('is nothing at all when nothing was measured', () => {
    expect(block('density', [['funnel', null]])).toEqual([]);
    expect(block('density', [])).toEqual([]);
  });

  it('keeps a value of zero, which is a reading', () => {
    expect(block('density', [['sand', 0]]).join('\n')).toContain('sand');
  });
});

describe('firstBlock', () => {
  it('has no blank in front of it', () => {
    const lines = firstBlock([['date', '2025-08-11']]);
    expect(lines[0]).toContain('date');
  });

  it('filters the same way', () => {
    expect(firstBlock([['date', null]])).toEqual([]);
  });
});

describe('tableBlock', () => {
  it('tables the rows under a heading', () => {
    const lines = tableBlock(
      'products',
      [{ key: 'name', heading: 'product' }],
      [{ name: 'barite' }]
    );
    expect(lines[1]).toBe('PRODUCTS');
    expect(lines[2]).toContain('barite');
  });

  it('is nothing at all with no rows', () => {
    expect(tableBlock('products', [{ key: 'name' }], [])).toEqual([]);
    expect(tableBlock('products', [{ key: 'name' }], null)).toEqual([]);
  });
});

describe('listBlock', () => {
  it('indents each line under a heading', () => {
    const lines = listBlock('activity', ['drilled ahead']);
    expect(lines[1]).toBe('ACTIVITY');
    expect(lines[2]).toBe('  drilled ahead');
  });

  it('is nothing at all with no lines', () => {
    expect(listBlock('activity', [])).toEqual([]);
    expect(listBlock('activity', undefined)).toEqual([]);
  });
});

describe('every block leaves the page alone when it has nothing to say', () => {
  it('so a page built of empty blocks is only its title', () => {
    const page = [
      ...title('empty report', 20),
      ...block('density', [['weight', null]]),
      ...tableBlock('products', [{ key: 'name' }], []),
      ...listBlock('activity', []),
    ];
    expect(page).toHaveLength(2);
  });
});
