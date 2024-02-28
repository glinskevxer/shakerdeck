/**
 * The wellbore as the desk models it: a hole made of cased and open sections,
 * and a string made of tubular sections run from the bottom up.
 *
 * The two are matched section by section so that the annulus is worked out
 * against whatever the pipe is actually inside at that depth, which is the
 * part a single average diameter gets wrong on a well with two casing strings
 * still in the hole.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { boreCapacity, annularCapacity, steelDisplacement } from './capacity.js';

/**
 * Read the hole: a list of sections from surface down, each with an inside
 * diameter and the depth its bottom sits at.
 */
export function readHole(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('the hole needs at least one section');
  }
  const out = [];
  let top = 0;
  sections.forEach((section, index) => {
    const label = section?.name ?? `hole section ${index + 1}`;
    const id = toPositive(section?.idInches, `${label} idInches`);
    const bottom = toPositive(section?.bottomFeet, `${label} bottomFeet`);
    if (bottom <= top) {
      throw new Error(`${label} ends at ${bottom} which is not below ${top}`);
    }
    out.push({
      name: String(label),
      idInches: id,
      topFeet: top,
      bottomFeet: bottom,
      lengthFeet: bottom - top,
      cased: Boolean(section?.cased),
    });
    top = bottom;
  });
  return out;
}

/**
 * Read the string: a list of sections from the bit up, each with a length.
 * The returned rows carry the depth each section sits between.
 */
export function readString(sections, totalDepthFeet) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('the string needs at least one section');
  }
  const depth = toPositive(totalDepthFeet, 'totalDepthFeet');
  const rows = sections.map((section, index) => {
    const label = section?.name ?? `string section ${index + 1}`;
    return {
      name: String(label),
      odInches: toPositive(section?.odInches, `${label} odInches`),
      idInches: toPositive(section?.idInches, `${label} idInches`),
      lengthFeet: toPositive(section?.lengthFeet, `${label} lengthFeet`),
    };
  });
  const run = rows.reduce((total, row) => total + row.lengthFeet, 0);
  if (run > depth + 1e-6) {
    throw new Error(`the string is ${round(run, 1)} feet long in a ${depth} foot hole`);
  }
  let bottom = depth;
  const placed = [];
  for (const row of rows) {
    const top = bottom - row.lengthFeet;
    placed.push({ ...row, topFeet: round(top, 3), bottomFeet: round(bottom, 3) });
    bottom = top;
  }
  return placed.reverse();
}

function overlap(aTop, aBottom, bTop, bBottom) {
  const top = Math.max(aTop, bTop);
  const bottom = Math.min(aBottom, bBottom);
  return bottom > top ? bottom - top : 0;
}

/**
 * The annulus, split at every point where either the hole or the string
 * changes. Each row is one length of constant geometry.
 */
export function annulusProfile(hole, string) {
  const rows = [];
  for (const holeSection of hole) {
    let covered = 0;
    for (const pipe of string) {
      const shared = overlap(
        holeSection.topFeet,
        holeSection.bottomFeet,
        pipe.topFeet,
        pipe.bottomFeet
      );
      if (shared <= 0) {
        continue;
      }
      covered += shared;
      rows.push({
        holeName: holeSection.name,
        pipeName: pipe.name,
        idInches: holeSection.idInches,
        odInches: pipe.odInches,
        lengthFeet: round(shared, 3),
        capacityBblPerFoot: round(annularCapacity(holeSection.idInches, pipe.odInches), 5),
        volumeBbl: round(annularCapacity(holeSection.idInches, pipe.odInches) * shared, 2),
      });
    }
    const bare = holeSection.lengthFeet - covered;
    if (bare > 1e-6) {
      rows.push({
        holeName: holeSection.name,
        pipeName: 'open',
        idInches: holeSection.idInches,
        odInches: 0,
        lengthFeet: round(bare, 3),
        capacityBblPerFoot: round(boreCapacity(holeSection.idInches), 5),
        volumeBbl: round(boreCapacity(holeSection.idInches) * bare, 2),
      });
    }
  }
  return rows;
}

/**
 * Every volume the hole holds, as the daily report lists them.
 */
export function wellVolumes({ hole, string, washoutFraction = 0 }) {
  const holeRows = readHole(hole?.sections ?? hole);
  const stringRows = readString(
    string?.sections ?? string,
    hole?.totalDepthFeet ?? holeRows.at(-1).bottomFeet
  );
  const washout = toNonNegative(washoutFraction, 'washoutFraction');
  const annulus = annulusProfile(holeRows, stringRows);
  const annulusBbl = annulus.reduce((total, row) => {
    const factor = holeRows.find((h) => h.name === row.holeName)?.cased ? 1 : 1 + washout;
    // The capacity on the row is rounded for printing. Totalling the rounded
    // figure over a dozen sections drifts by a barrel or more, so the total is
    // taken from the diameters again.
    const exact =
      row.odInches > 0 ? annularCapacity(row.idInches, row.odInches) : boreCapacity(row.idInches);
    return total + exact * row.lengthFeet * factor;
  }, 0);
  const stringBbl = stringRows.reduce(
    (total, row) => total + boreCapacity(row.idInches) * row.lengthFeet,
    0
  );
  const steelBbl = stringRows.reduce(
    (total, row) => total + steelDisplacement(row.odInches, row.idInches) * row.lengthFeet,
    0
  );
  return {
    holeSections: holeRows,
    stringSections: stringRows,
    annulus,
    annulusBbl: round(annulusBbl, 2),
    stringBbl: round(stringBbl, 2),
    steelDisplacementBbl: round(steelBbl, 2),
    holeVolumeBbl: round(annulusBbl + stringBbl, 2),
  };
}
