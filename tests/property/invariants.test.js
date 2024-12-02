import { describe, it, expect } from 'vitest';
import { boreCapacity, annularCapacity, steelDisplacement } from '../../src/well/capacity.js';
import { pipeVelocity, annularVelocity } from '../../src/hydraulics/velocity.js';
import { pipeLoss, annularLoss } from '../../src/hydraulics/pressure-loss.js';
import { bitPressureDrop, totalFlowArea } from '../../src/hydraulics/bit.js';
import { plasticViscosity, yieldPoint } from '../../src/rheology/bingham.js';
import { powerLawFrom, stressAt } from '../../src/rheology/powerlaw.js';
import { shearRate } from '../../src/rheology/dial.js';
import { weightUp, cutBack, blendWeight } from '../../src/material/weightup.js';
import { soliditySplit } from '../../src/solids/analysis.js';
import { equivalentCirculatingDensity } from '../../src/hydraulics/ecd.js';
import { round } from '../../src/util/number.js';

/**
 * A small deterministic generator, so a failure can be reproduced from the
 * seed printed in the message rather than being a different case every run.
 */
function generator(seed) {
  let state = seed;
  return (low, high) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return low + (state / 2147483648) * (high - low);
  };
}

const model = { n: 0.6077, k: 1.014 };
const annular = { n: 0.4352, k: 2.6258 };

describe('capacities', () => {
  const next = generator(11);

  it('always add up to the whole hole', () => {
    for (let i = 0; i < 200; i += 1) {
      const hole = next(6, 17.5);
      const od = next(2, hole - 0.5);
      const id = next(0.5, od - 0.25);
      const whole = boreCapacity(hole);
      const parts = annularCapacity(hole, od) + steelDisplacement(od, id) + boreCapacity(id);
      expect(parts).toBeCloseTo(whole, 9);
    }
  });

  it('never come back negative', () => {
    for (let i = 0; i < 200; i += 1) {
      const hole = next(6, 17.5);
      const od = next(2, hole - 0.5);
      expect(annularCapacity(hole, od)).toBeGreaterThan(0);
    }
  });
});

describe('velocity', () => {
  const next = generator(23);

  it('always rises with rate and falls as the gap opens', () => {
    for (let i = 0; i < 200; i += 1) {
      const hole = next(6, 17.5);
      const od = next(2, hole - 1);
      const rate = next(50, 1200);
      expect(annularVelocity(rate * 2, hole, od)).toBeCloseTo(
        annularVelocity(rate, hole, od) * 2,
        6
      );
      expect(annularVelocity(rate, hole + 1, od)).toBeLessThan(annularVelocity(rate, hole, od));
    }
  });

  it('is always faster inside the pipe than around it on a working string', () => {
    for (let i = 0; i < 100; i += 1) {
      const rate = next(200, 900);
      expect(pipeVelocity(rate, 4.276)).toBeGreaterThan(annularVelocity(rate, 8.5, 5));
    }
  });
});

describe('pressure loss', () => {
  const next = generator(37);

  it('always rises with rate', () => {
    for (let i = 0; i < 60; i += 1) {
      const rate = next(100, 800);
      const slow = pipeLoss({
        flowGpm: rate,
        idInches: 4.276,
        lengthFeet: 9400,
        densityPpg: 12.4,
        model,
      });
      const fast = pipeLoss({
        flowGpm: rate * 1.2,
        idInches: 4.276,
        lengthFeet: 9400,
        densityPpg: 12.4,
        model,
      });
      expect(fast.psi).toBeGreaterThan(slow.psi);
    }
  });

  it('always rises with length, in proportion', () => {
    for (let i = 0; i < 60; i += 1) {
      const length = next(500, 12000);
      const one = annularLoss({
        flowGpm: 600,
        holeIdInches: 8.5,
        pipeOdInches: 5,
        lengthFeet: length,
        densityPpg: 12.4,
        model: annular,
      });
      const two = annularLoss({
        flowGpm: 600,
        holeIdInches: 8.5,
        pipeOdInches: 5,
        lengthFeet: length * 2,
        densityPpg: 12.4,
        model: annular,
      });
      expect(two.psi).toBeCloseTo(one.psi * 2, 0);
    }
  });

  it('always rises with mud weight', () => {
    for (let i = 0; i < 60; i += 1) {
      const weight = next(8.4, 17);
      const light = pipeLoss({
        flowGpm: 600,
        idInches: 4.276,
        lengthFeet: 9400,
        densityPpg: weight,
        model,
      });
      const heavy = pipeLoss({
        flowGpm: 600,
        idInches: 4.276,
        lengthFeet: 9400,
        densityPpg: weight + 1,
        model,
      });
      expect(heavy.psi).toBeGreaterThan(light.psi);
    }
  });
});

describe('the bit', () => {
  const next = generator(53);

  it('always goes with the square of the rate', () => {
    for (let i = 0; i < 100; i += 1) {
      const area = totalFlowArea([Math.round(next(9, 20))]);
      const rate = next(100, 900);
      const one = bitPressureDrop({
        flowGpm: rate,
        totalFlowAreaSquareInches: area,
        densityPpg: 12.4,
      });
      const two = bitPressureDrop({
        flowGpm: rate * 2,
        totalFlowAreaSquareInches: area,
        densityPpg: 12.4,
      });
      expect(two / one).toBeCloseTo(4, 6);
    }
  });
});

describe('rheology', () => {
  const next = generator(71);

  it('always passes the power law fit through both readings', () => {
    for (let i = 0; i < 200; i += 1) {
      const three = Math.round(next(8, 60));
      const six = Math.round(next(three + 1, three * 2.4));
      const fit = powerLawFrom({ 600: six, 300: three }, 600, 300);
      expect(stressAt(fit, shearRate(300)) / 1.0678).toBeCloseTo(three, 6);
      expect(stressAt(fit, shearRate(600)) / 1.0678).toBeCloseTo(six, 6);
    }
  });

  it('always splits the three hundred reading between pv and yp', () => {
    for (let i = 0; i < 200; i += 1) {
      const three = Math.round(next(8, 60));
      const six = Math.round(next(three, three * 2.4));
      const dials = { 600: six, 300: three };
      expect(plasticViscosity(dials) + yieldPoint(dials)).toBe(three);
    }
  });
});

describe('material balance', () => {
  const next = generator(97);

  it('always lands on the weight it was asked for', () => {
    for (let i = 0; i < 200; i += 1) {
      const from = next(8.5, 16);
      const to = next(from + 0.1, 18);
      const volume = next(100, 2000);
      const order = weightUp({ fromPpg: from, toPpg: to, volumeBbl: volume });
      const blend = blendWeight([
        { volumeBbl: volume, weightPpg: from },
        { volumeBbl: order.volumeIncreaseBbl, weightPpg: 4.2 * 8.3454 },
      ]);
      expect(blend.weightPpg).toBeCloseTo(round(to, 2), 1);
    }
  });

  it('always grows the system when it is cut back', () => {
    for (let i = 0; i < 200; i += 1) {
      const from = next(10, 17);
      const to = next(9, from - 0.1);
      const volume = next(100, 2000);
      const order = cutBack({ fromPpg: from, toPpg: to, volumeBbl: volume });
      expect(order.finalVolumeBbl).toBeGreaterThan(volume);
    }
  });
});

describe('solids', () => {
  const next = generator(131);

  it('always splits the retort solids into two parts that add back up', () => {
    for (let i = 0; i < 200; i += 1) {
      const solids = next(6, 30);
      const water = 100 - solids;
      const weight = next(9.5, 17);
      const split = soliditySplit({
        weightPpg: weight,
        solidsPercent: solids,
        waterPercent: water,
      });
      expect(split.highGravityPercent + split.lowGravityPercent).toBeCloseTo(solids, 1);
    }
  });
});

describe('circulating density', () => {
  const next = generator(151);

  it('is never below the static weight', () => {
    for (let i = 0; i < 200; i += 1) {
      const weight = next(8.5, 18);
      const loss = next(0, 900);
      const depth = next(1000, 22000);
      expect(
        equivalentCirculatingDensity({ weightPpg: weight, annularLossPsi: loss, tvdFeet: depth })
      ).toBeGreaterThanOrEqual(weight);
    }
  });
});
