import { describe, it, expect } from 'vitest';
import { transfer, transferForWeight, runTransfers } from '../../src/pits/transfer.js';

const heavy = { name: 'reserve', volumeBbl: 300, weightPpg: 15 };
const light = { name: 'active', volumeBbl: 700, weightPpg: 12 };

describe('transfer', () => {
  const moved = transfer({ from: heavy, to: light, volumeBbl: 100 });

  it('takes the volume out of one pit and puts it in the other', () => {
    expect(moved.from.volumeBbl).toBe(200);
    expect(moved.to.volumeBbl).toBe(800);
  });

  it('leaves the source weight alone and moves the destination weight', () => {
    expect(moved.from.weightPpg).toBe(15);
    expect(moved.to.weightPpg).toBe(12.38);
  });

  it('moves the destination weight towards the source', () => {
    expect(moved.to.weightPpg).toBeGreaterThan(12);
    expect(moved.to.weightPpg).toBeLessThan(15);
  });

  it('carries the pit names through', () => {
    expect(moved.from.name).toBe('reserve');
    expect(moved.to.name).toBe('active');
  });

  it('refuses to move more than the pit holds', () => {
    expect(() => transfer({ from: heavy, to: light, volumeBbl: 400 })).toThrow(
      /reserve only holds 300 barrels/
    );
  });

  it('moves into an empty pit', () => {
    const into = transfer({
      from: heavy,
      to: { name: 'trip tank', volumeBbl: 0, weightPpg: 15 },
      volumeBbl: 50,
    });
    expect(into.to.volumeBbl).toBe(50);
    expect(into.to.weightPpg).toBe(15);
  });
});

describe('transferForWeight', () => {
  it('works out the volume to land on a weight', () => {
    const needed = transferForWeight({ from: heavy, to: light, targetPpg: 12.5 });
    expect(needed.volumeBbl).toBe(140);
    expect(needed.enoughInThePit).toBe(true);
  });

  it('lands where it said it would', () => {
    const needed = transferForWeight({ from: heavy, to: light, targetPpg: 12.5 });
    const moved = transfer({ from: heavy, to: light, volumeBbl: needed.volumeBbl });
    expect(moved.to.weightPpg).toBeCloseTo(12.5, 1);
  });

  it('says when there is not enough in the pit', () => {
    const needed = transferForWeight({ from: heavy, to: light, targetPpg: 14 });
    expect(needed.enoughInThePit).toBe(false);
    expect(needed.shortBy).toBeGreaterThan(0);
  });

  it('refuses a target outside the two weights', () => {
    expect(() => transferForWeight({ from: heavy, to: light, targetPpg: 16 })).toThrow(
      /not between 12 and 15/
    );
    expect(() => transferForWeight({ from: heavy, to: light, targetPpg: 11 })).toThrow(
      /not between/
    );
  });

  it('refuses a target the source is already at', () => {
    expect(() => transferForWeight({ from: heavy, to: light, targetPpg: 15 })).toThrow(
      /already at 15/
    );
  });
});

describe('runTransfers', () => {
  const pits = [
    { name: 'active', volumeBbl: 700, weightPpg: 12 },
    { name: 'reserve', volumeBbl: 300, weightPpg: 15 },
    { name: 'slug', volumeBbl: 40, weightPpg: 16 },
  ];

  it('runs them in order and carries the result forward', () => {
    const run = runTransfers({
      pits,
      transfers: [
        { from: 'reserve', to: 'active', volumeBbl: 100 },
        { from: 'reserve', to: 'active', volumeBbl: 100 },
      ],
    });
    expect(run.transfers).toHaveLength(2);
    expect(run.pits.find((pit) => pit.name === 'reserve').volumeBbl).toBe(100);
    expect(run.pits.find((pit) => pit.name === 'active').volumeBbl).toBe(900);
  });

  it('gets the same answer as one transfer of the total', () => {
    const twice = runTransfers({
      pits,
      transfers: [
        { from: 'reserve', to: 'active', volumeBbl: 100 },
        { from: 'reserve', to: 'active', volumeBbl: 100 },
      ],
    });
    const once = runTransfers({
      pits,
      transfers: [{ from: 'reserve', to: 'active', volumeBbl: 200 }],
    });
    expect(twice.pits.find((pit) => pit.name === 'active').weightPpg).toBeCloseTo(
      once.pits.find((pit) => pit.name === 'active').weightPpg,
      2
    );
  });

  it('refuses a transfer from a pit that is not there', () => {
    expect(() =>
      runTransfers({ pits, transfers: [{ from: 'sump', to: 'active', volumeBbl: 10 }] })
    ).toThrow(/transfer 1 is from sump/);
  });

  it('refuses a transfer to a pit that is not there', () => {
    expect(() =>
      runTransfers({ pits, transfers: [{ from: 'active', to: 'sump', volumeBbl: 10 }] })
    ).toThrow(/transfer 1 is to sump/);
  });

  it('stops when a pit runs dry part way down the list', () => {
    expect(() =>
      runTransfers({
        pits,
        transfers: [
          { from: 'slug', to: 'active', volumeBbl: 30 },
          { from: 'slug', to: 'active', volumeBbl: 30 },
        ],
      })
    ).toThrow(/only holds 10 barrels/);
  });

  it('leaves the pits it was given alone', () => {
    runTransfers({ pits, transfers: [{ from: 'reserve', to: 'active', volumeBbl: 100 }] });
    expect(pits[0].volumeBbl).toBe(700);
  });
});
