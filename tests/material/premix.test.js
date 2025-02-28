import { describe, it, expect } from 'vitest';
import {
  MIXING_RULES,
  mixTime,
  mixingOrder,
  fitsTheWindow,
  mixingSequence,
} from '../../src/material/premix.js';

const lines = [
  { code: 'BAR', name: 'barite', category: 'weighting', sacks: 120 },
  { code: 'PAC', name: 'polyanionic cellulose', category: 'polymer', sacks: 12 },
  { code: 'CAU', name: 'caustic soda', category: 'alkalinity', sacks: 8 },
];

describe('mixTime', () => {
  it('cuts barite faster than polymer', () => {
    expect(MIXING_RULES.weighting.sacksPerMinute).toBeGreaterThan(
      MIXING_RULES.polymer.sacksPerMinute
    );
    expect(mixTime({ category: 'weighting', sacks: 60 }).cuttingMinutes).toBeLessThan(
      mixTime({ category: 'polymer', sacks: 60 }).cuttingMinutes
    );
  });

  it('makes polymer wait to yield before it is worth anything', () => {
    const polymer = mixTime({ category: 'polymer', sacks: 12 });
    expect(polymer.readyInMinutes).toBeGreaterThan(polymer.cuttingMinutes + 30);
  });

  it('makes barite ready as soon as it is cut', () => {
    const barite = mixTime({ category: 'weighting', sacks: 120 });
    expect(barite.readyInMinutes).toBe(barite.cuttingMinutes);
  });

  it('falls back to the general rule for a category it does not know', () => {
    expect(mixTime({ category: 'corrosion', sacks: 8 }).cuttingMinutes).toBe(
      mixTime({ category: 'general', sacks: 8 }).cuttingMinutes
    );
  });

  it('takes twice as long on half a hopper', () => {
    expect(mixTime({ category: 'weighting', sacks: 120, hopperShare: 0.5 }).cuttingMinutes).toBe(
      mixTime({ category: 'weighting', sacks: 120 }).cuttingMinutes * 2
    );
  });

  it('refuses more than the whole hopper', () => {
    expect(() => mixTime({ category: 'weighting', sacks: 120, hopperShare: 2 })).toThrow(
      /more than the whole hopper/
    );
  });

  it('takes no time at all for no sacks', () => {
    expect(mixTime({ category: 'weighting', sacks: 0 }).cuttingMinutes).toBe(0);
  });
});

describe('mixingOrder', () => {
  const order = mixingOrder({ lines });

  it('runs the hopper one product after another', () => {
    expect(order.lines[0].startsAtMinute).toBe(0);
    expect(order.lines[1].startsAtMinute).toBe(order.lines[0].cuttingMinutes);
  });

  it('totals the cutting time', () => {
    expect(order.cuttingMinutes).toBeCloseTo(
      order.lines.reduce((total, line) => total + line.cuttingMinutes, 0),
      1
    );
  });

  it('is not ready until the slowest product has yielded', () => {
    expect(order.readyInMinutes).toBeGreaterThan(order.cuttingMinutes);
    expect(order.lastReady.code).toBe('PAC');
  });
});

describe('fitsTheWindow', () => {
  const order = mixingOrder({ lines });

  it('fits when there is time', () => {
    expect(fitsTheWindow({ order, minutesAvailable: 240 }).fits).toBe(true);
  });

  it('does not when there is not', () => {
    const tight = fitsTheWindow({ order, minutesAvailable: 20 });
    expect(tight.fits).toBe(false);
    expect(tight.shortByMinutes).toBeGreaterThan(0);
    expect(tight.holdingItUp).toBe('polyanionic cellulose');
  });

  it('names nothing when it fits', () => {
    expect(fitsTheWindow({ order, minutesAvailable: 240 }).holdingItUp).toBe(null);
  });

  it('refuses a window of no time', () => {
    expect(() => fitsTheWindow({ order, minutesAvailable: 0 })).toThrow(/above zero/);
  });
});

describe('mixingSequence', () => {
  it('puts what has to yield first', () => {
    const sequence = mixingSequence(lines);
    expect(sequence[0].code).toBe('PAC');
  });

  it('puts what only needs shear next', () => {
    const sequence = mixingSequence(lines);
    expect(sequence[1].code).toBe('CAU');
    expect(sequence.at(-1).code).toBe('BAR');
  });

  it('leaves the list it was given alone', () => {
    mixingSequence(lines);
    expect(lines[0].code).toBe('BAR');
  });

  it('puts clay ahead of polymer, because it takes four hours', () => {
    const sequence = mixingSequence([
      { code: 'PAC', category: 'polymer', sacks: 1 },
      { code: 'GEL', category: 'clay', sacks: 1 },
    ]);
    expect(sequence[0].code).toBe('GEL');
  });
});
