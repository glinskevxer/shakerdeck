import { describe, it, expect } from 'vitest';
import { fixtures } from '../support/fixtures.js';
import { buildMorning, renderMorning, morningSubject } from '../../src/report/morning.js';
import { readProgramme } from '../../src/program/window.js';

const check = fixtures.check;
const checks = fixtures.checks;
const programme = readProgramme(fixtures.programme);

const morning = buildMorning({
  well: 'brazos 14-3',
  date: '2024-08-19',
  check,
  previousCheck: checks[4],
  programme,
  shortages: [{ name: 'polyanionic cellulose' }],
  activity: 'running eight and a half inch hole to section total depth',
});

describe('buildMorning', () => {
  it('says how far the well came since the last check', () => {
    expect(morning.madeFeet).toBe(400);
    expect(morning.overDays).toBe(1);
  });

  it('says which way the weight moved', () => {
    expect(morning.weightChangePpg).toBeCloseTo(0.1, 2);
  });

  it('leaves the comparison out with no previous check', () => {
    const first = buildMorning({ well: 'x', date: '2024-08-19', check });
    expect(first.madeFeet).toBe(null);
    expect(first.weightChangePpg).toBe(null);
  });

  it('judges against the programme when there is one', () => {
    expect(morning.section).toBe('intermediate');
    expect(morning.exceptions).toEqual([]);
  });

  it('says so when there is not', () => {
    expect(buildMorning({ well: 'x', date: '2024-08-19', check }).section).toBe(null);
  });

  it('carries the shortages through', () => {
    expect(morning.shortages).toHaveLength(1);
  });
});

describe('renderMorning', () => {
  const lines = renderMorning(morning);

  it('is four lines and never five', () => {
    expect(lines).toHaveLength(4);
    expect(renderMorning(buildMorning({ well: 'x', date: '2024-08-19', check }))).toHaveLength(4);
  });

  it('leads with where the well is', () => {
    expect(lines[0]).toContain('brazos 14-3 at 10450 ft');
    expect(lines[0]).toContain('400 ft made');
  });

  it('says what the mud is doing', () => {
    expect(lines[1]).toContain('12.4 ppg');
    expect(lines[1]).toContain('pv 22');
    expect(lines[1]).toContain('up 0.1');
  });

  it('says nothing about a weight that did not move', () => {
    const flat = renderMorning(
      buildMorning({ well: 'x', date: '2024-08-19', check, previousCheck: check })
    );
    expect(flat[1]).not.toContain('up');
    expect(flat[1]).not.toContain('down');
  });

  it('names what is outside the window', () => {
    const tight = readProgramme({
      well: 'x',
      sections: [
        { name: 'all', fromFeet: 0, toFeet: 12000, limits: { plasticViscosity: { max: 20 } } },
      ],
    });
    const out = renderMorning(
      buildMorning({ well: 'x', date: '2024-08-19', check, programme: tight })
    );
    expect(out[2]).toContain('outside the all window on plastic viscosity');
  });

  it('says when nothing is short', () => {
    const stocked = renderMorning(buildMorning({ well: 'x', date: '2024-08-19', check }));
    expect(stocked[3]).toContain('nothing short');
  });

  it('names what is short when something is', () => {
    expect(lines[3]).toContain('short of polyanionic cellulose');
  });

  it('takes a shortage given as a bare name', () => {
    const named = renderMorning(
      buildMorning({ well: 'x', date: '2024-08-19', check, shortages: ['barite'] })
    );
    expect(named[3]).toContain('short of barite');
  });

  it('puts the activity on the end of the last line', () => {
    expect(lines[3]).toContain('running eight and a half inch hole');
  });
});

describe('morningSubject', () => {
  it('is all most people read', () => {
    expect(morningSubject(morning)).toBe('brazos 14-3 2024-08-19: 10450 ft, 12.4 ppg, in window');
  });

  it('counts what is out', () => {
    const tight = readProgramme({
      well: 'x',
      sections: [
        { name: 'all', fromFeet: 0, toFeet: 12000, limits: { plasticViscosity: { max: 20 } } },
      ],
    });
    const subject = morningSubject(
      buildMorning({ well: 'x', date: '2024-08-19', check, programme: tight })
    );
    expect(subject).toContain('1 out');
  });
});
