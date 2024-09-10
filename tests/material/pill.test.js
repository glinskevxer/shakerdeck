import { describe, it, expect } from 'vitest';
import {
  LOST_CIRCULATION_MATERIALS,
  lostCirculationPill,
  viscousSweep,
  weightedPill,
  pillPlacement,
} from '../../src/material/pill.js';

describe('lostCirculationPill', () => {
  it('bridges a wider opening on a coarser grade', () => {
    expect(LOST_CIRCULATION_MATERIALS.coarse.bridgesMicrons).toBeGreaterThan(
      LOST_CIRCULATION_MATERIALS.fine.bridgesMicrons
    );
  });

  it('mixes at the usual strength', () => {
    const pill = lostCirculationPill({ grade: 'medium', volumeBbl: 50 });
    expect(pill.concentrationLbBbl).toBe(30);
    expect(pill.totalPounds).toBe(1500);
    expect(pill.sacks).toBe(30);
  });

  it('takes a strength off the drilling programme', () => {
    const pill = lostCirculationPill({ grade: 'medium', volumeBbl: 50, concentrationLbBbl: 60 });
    expect(pill.totalPounds).toBe(3000);
  });

  it('reports the volume the material adds', () => {
    expect(
      lostCirculationPill({ grade: 'medium', volumeBbl: 50 }).volumeIncreaseBbl
    ).toBeGreaterThan(0);
  });

  it('rounds the sacks up', () => {
    expect(lostCirculationPill({ grade: 'fine', volumeBbl: 7 }).sacks).toBe(3);
  });

  it('refuses a grade it does not stock', () => {
    expect(() => lostCirculationPill({ grade: 'enormous', volumeBbl: 50 })).toThrow(
      /no lost circulation grade called enormous/
    );
  });
});

describe('viscousSweep', () => {
  it('sizes a sweep to the annulus it has to fill', () => {
    const sweep = viscousSweep({ annularCapacityBblPerFoot: 0.0459 });
    expect(sweep.volumeBbl).toBe(11.5);
    expect(sweep.tooSmall).toBe(false);
  });

  it('needs more in a wider hole', () => {
    expect(viscousSweep({ annularCapacityBblPerFoot: 0.1 }).volumeBbl).toBeGreaterThan(
      viscousSweep({ annularCapacityBblPerFoot: 0.0459 }).volumeBbl
    );
  });

  it('flags a sweep too short to survive the trip up', () => {
    expect(viscousSweep({ annularCapacityBblPerFoot: 0.0459, coverFeet: 100 }).tooSmall).toBe(true);
  });
});

describe('weightedPill', () => {
  it('builds a heavy pill out of the mud in the pits', () => {
    const pill = weightedPill({ pillPpg: 15, mudPpg: 12.4, volumeBbl: 40 });
    expect(pill.sacks).toBeGreaterThan(0);
    expect(pill.pillPpg).toBe(15);
  });

  it('refuses a pill lighter than the mud', () => {
    expect(() => weightedPill({ pillPpg: 11, mudPpg: 12.4, volumeBbl: 40 })).toThrow(/not above/);
  });
});

describe('pillPlacement', () => {
  const geometry = {
    stringCapacityBbl: 171.6,
    annularCapacityBblPerFoot: 0.0459,
    totalDepthFeet: 10450,
  };

  it('says the pill is still in the string on a short chase', () => {
    const placed = pillPlacement({ pillBbl: 40, chaseBbl: 100, ...geometry });
    expect(placed.inString).toBe(true);
    expect(placed.shortBySeveral).toBeGreaterThan(0);
  });

  it('places it in the annulus once the string is displaced', () => {
    const placed = pillPlacement({ pillBbl: 40, chaseBbl: 200, ...geometry });
    expect(placed.inString).toBe(false);
    expect(placed.pillBottomFeet).toBeLessThan(geometry.totalDepthFeet);
    expect(placed.pillTopFeet).toBeLessThan(placed.pillBottomFeet);
  });

  it('gives the pill its own length in the annulus', () => {
    const placed = pillPlacement({ pillBbl: 40, chaseBbl: 200, ...geometry });
    expect(placed.pillLengthFeet).toBe(Math.round(40 / 0.0459));
  });

  it('moves the pill further up on a longer chase', () => {
    const early = pillPlacement({ pillBbl: 40, chaseBbl: 200, ...geometry });
    const late = pillPlacement({ pillBbl: 40, chaseBbl: 300, ...geometry });
    expect(late.pillBottomFeet).toBeLessThan(early.pillBottomFeet);
  });

  it('never places a pill above surface', () => {
    const placed = pillPlacement({ pillBbl: 40, chaseBbl: 5000, ...geometry });
    expect(placed.pillTopFeet).toBe(0);
    expect(placed.pillBottomFeet).toBe(0);
  });
});
