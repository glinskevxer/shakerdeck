import { describe, it, expect } from 'vitest';
import {
  LOSS_BANDS,
  lossBand,
  firstTreatment,
  lossCost,
  treatmentLadder,
} from '../../src/program/contingency.js';

describe('lossBand', () => {
  it('runs from seepage to total', () => {
    expect(LOSS_BANDS.map((band) => band.name)).toEqual(['seepage', 'partial', 'severe', 'total']);
  });

  it('places a rate in its band', () => {
    expect(lossBand(4).name).toBe('seepage');
    expect(lossBand(30).name).toBe('partial');
    expect(lossBand(120).name).toBe('severe');
    expect(lossBand(400).name).toBe('total');
  });

  it('takes each band at its upper edge', () => {
    expect(lossBand(10).name).toBe('seepage');
    expect(lossBand(50).name).toBe('partial');
    expect(lossBand(150).name).toBe('severe');
  });

  it('reads no losses at all', () => {
    expect(lossBand(0).name).toBe('none');
  });

  it('uses a coarser material as the losses get worse', () => {
    expect(lossBand(4).concentrationLbBbl).toBeLessThan(lossBand(120).concentrationLbBbl);
  });
});

describe('firstTreatment', () => {
  const treatment = firstTreatment({
    barrelsPerHour: 30,
    annularCapacityBblPerFoot: 0.0459,
    systemBbl: 800,
  });

  it('sizes the pill to the hole it has to cover', () => {
    const wide = firstTreatment({
      barrelsPerHour: 30,
      annularCapacityBblPerFoot: 0.15,
      systemBbl: 800,
    });
    expect(wide.pill.volumeBbl).toBeCloseTo(0.15 * 300, 0);
    expect(wide.pill.volumeBbl).toBeGreaterThan(treatment.pill.volumeBbl);
  });

  it('never mixes a pill too small to be worth spotting', () => {
    const tiny = firstTreatment({
      barrelsPerHour: 4,
      annularCapacityBblPerFoot: 0.005,
      systemBbl: 800,
    });
    expect(tiny.pill.volumeBbl).toBe(20);
  });

  it('says how long the system will last at that rate', () => {
    expect(treatment.hoursOfSystem).toBeCloseTo(800 / 30, 1);
  });

  it('says to stop pumping on a total loss', () => {
    const total = firstTreatment({
      barrelsPerHour: 400,
      annularCapacityBblPerFoot: 0.0459,
      systemBbl: 800,
    });
    expect(total.action).toMatch(/stop pumping/);
  });

  it('has nothing to do when nothing is being lost', () => {
    const none = firstTreatment({
      barrelsPerHour: 0,
      annularCapacityBblPerFoot: 0.0459,
      systemBbl: 800,
    });
    expect(none.pill).toBe(null);
    expect(none.action).toBe('nothing to treat');
  });

  it('uses a coarser grade on worse losses', () => {
    const partial = firstTreatment({
      barrelsPerHour: 30,
      annularCapacityBblPerFoot: 0.0459,
      systemBbl: 800,
    });
    const severe = firstTreatment({
      barrelsPerHour: 120,
      annularCapacityBblPerFoot: 0.0459,
      systemBbl: 800,
    });
    expect(severe.pill.bridgesMicrons).toBeGreaterThan(partial.pill.bridgesMicrons);
  });
});

describe('lossCost', () => {
  it('counts what went into the ground', () => {
    expect(lossCost({ barrelsPerHour: 30, hours: 8, mudCostPerBbl: 38 })).toEqual({
      lostBbl: 240,
      cost: 9120,
    });
  });

  it('is nothing when nothing was lost', () => {
    expect(lossCost({ barrelsPerHour: 0, hours: 8, mudCostPerBbl: 38 }).cost).toBe(0);
  });
});

describe('treatmentLadder', () => {
  const ladder = treatmentLadder({ annularCapacityBblPerFoot: 0.0459, systemBbl: 800 });

  it('has a rung for every band', () => {
    expect(ladder).toHaveLength(LOSS_BANDS.length);
  });

  it('leaves the top rung open ended', () => {
    expect(ladder.at(-1).upToBarrelsPerHour).toBe(null);
  });

  it('gets stronger down the ladder', () => {
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i].concentrationLbBbl).toBeGreaterThan(ladder[i - 1].concentrationLbBbl);
      expect(ladder[i].sacks).toBeGreaterThan(ladder[i - 1].sacks);
    }
  });

  it('carries the action for each rung', () => {
    expect(ladder[0].action).toMatch(/spot a/);
    expect(ladder.at(-1).action).toMatch(/cement plug/);
  });
});
