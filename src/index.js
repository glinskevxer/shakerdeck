/**
 * The public surface of the library, for anything that wants to use the desk
 * without going through the command line.
 */
export * as density from './units/density.js';
export * as measure from './units/measure.js';
export * as capacity from './well/capacity.js';
export * as pump from './well/pump.js';
export * as geometry from './well/geometry.js';
export * as dial from './rheology/dial.js';
export * as bingham from './rheology/bingham.js';
export * as powerlaw from './rheology/powerlaw.js';
export * as herschel from './rheology/herschel.js';
export * as compare from './rheology/compare.js';
export * as mudcheck from './mudcheck/record.js';
export * as alkalinity from './mudcheck/alkalinity.js';
export * as titration from './mudcheck/titration.js';
export * as clay from './mudcheck/clay.js';
export * as solids from './solids/analysis.js';
export * as velocity from './hydraulics/velocity.js';
export * as reynolds from './hydraulics/reynolds.js';
export * as pressureLoss from './hydraulics/pressure-loss.js';
export * as bit from './hydraulics/bit.js';
export * as ecd from './hydraulics/ecd.js';
export * as system from './hydraulics/system.js';
export * as cuttings from './hydraulics/cuttings.js';
export * as pits from './pits/geometry.js';
export * as totalizer from './pits/totalizer.js';
export * as weightup from './material/weightup.js';
export * as dilution from './material/dilution.js';
export { VERSION } from './version.js';
