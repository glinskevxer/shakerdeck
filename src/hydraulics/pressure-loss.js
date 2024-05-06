/**
 * Frictional pressure loss through the circulating system.
 *
 * One length of constant geometry at a time. The friction factor comes off the
 * Reynolds number for that length, and the loss per foot follows from it. The
 * two constants below are the API 13D forms for pounds a gallon, feet a second
 * and inches.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { pipeVelocity, annularVelocity, feetPerSecond } from './velocity.js';
import { reynoldsPipe, reynoldsAnnulus, frictionFactor, regime } from './reynolds.js';

/** Pipe form constant, psi per foot. */
export const PIPE_LOSS_CONSTANT = 25.81;

/** Annulus form constant, psi per foot. */
export const ANNULAR_LOSS_CONSTANT = 21.1;

/**
 * Loss through one length of pipe.
 */
export function pipeLoss({ flowGpm, idInches, lengthFeet, densityPpg, model }) {
  const id = toPositive(idInches, 'idInches');
  const length = toNonNegative(lengthFeet, 'lengthFeet');
  const density = toPositive(densityPpg, 'densityPpg');
  const velocity = feetPerSecond(pipeVelocity(flowGpm, id));
  const reynolds = reynoldsPipe({
    densityPpg: density,
    velocityFeetPerSecond: velocity,
    idInches: id,
    model,
  });
  const friction = frictionFactor(reynolds, model.n);
  const perFoot = (friction * density * velocity * velocity) / (PIPE_LOSS_CONSTANT * id);
  return {
    velocityFeetPerSecond: round(velocity, 3),
    reynolds: round(reynolds, 0),
    regime: regime(reynolds, model.n),
    frictionFactor: round(friction, 5),
    psiPerFoot: round(perFoot, 5),
    psi: round(perFoot * length, 1),
    lengthFeet: length,
  };
}

/**
 * Loss through one length of annulus.
 */
export function annularLoss({
  flowGpm,
  holeIdInches,
  pipeOdInches,
  lengthFeet,
  densityPpg,
  model,
}) {
  const hole = toPositive(holeIdInches, 'holeIdInches');
  const pipe = toNonNegative(pipeOdInches, 'pipeOdInches');
  const length = toNonNegative(lengthFeet, 'lengthFeet');
  const density = toPositive(densityPpg, 'densityPpg');
  const velocity = feetPerSecond(annularVelocity(flowGpm, hole, pipe));
  const reynolds = reynoldsAnnulus({
    densityPpg: density,
    velocityFeetPerSecond: velocity,
    holeIdInches: hole,
    pipeOdInches: pipe,
    model,
  });
  const friction = frictionFactor(reynolds, model.n);
  const perFoot =
    (friction * density * velocity * velocity) / (ANNULAR_LOSS_CONSTANT * (hole - pipe));
  return {
    velocityFeetPerMinute: round(velocity * 60, 1),
    velocityFeetPerSecond: round(velocity, 3),
    reynolds: round(reynolds, 0),
    regime: regime(reynolds, model.n),
    frictionFactor: round(friction, 5),
    psiPerFoot: round(perFoot, 5),
    psi: round(perFoot * length, 1),
    lengthFeet: length,
  };
}

/**
 * Loss down every section of the string.
 */
export function stringLoss(sections, { flowGpm, densityPpg, model }) {
  const rows = sections.map((section) => ({
    name: section.name,
    ...pipeLoss({
      flowGpm,
      idInches: section.idInches,
      lengthFeet: section.lengthFeet,
      densityPpg,
      model,
    }),
  }));
  return {
    sections: rows,
    psi: round(
      rows.reduce((total, row) => total + row.psi, 0),
      1
    ),
  };
}

/**
 * Loss back up every length of the annulus.
 */
export function annulusLoss(rows, { flowGpm, densityPpg, model }) {
  const sections = rows.map((row) => ({
    holeName: row.holeName,
    pipeName: row.pipeName,
    ...annularLoss({
      flowGpm,
      holeIdInches: row.idInches,
      pipeOdInches: row.odInches,
      lengthFeet: row.lengthFeet,
      densityPpg,
      model,
    }),
  }));
  return {
    sections,
    psi: round(
      sections.reduce((total, row) => total + row.psi, 0),
      1
    ),
  };
}
