/**
 * The well estimate.
 *
 * Every section planned, added up, with the contingency the client asks for on
 * the end. It is the number in the tender and it is the number the job gets
 * judged against, so the assumptions behind it are carried through into the
 * result rather than left in somebody's spreadsheet.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { sectionPlan } from '../program/section.js';

/**
 * Estimate the whole well, section by section.
 */
export function estimateWell({
  programme,
  treatments,
  products,
  surfaceSystemBbl,
  serviceRatePerDay = 0,
  rentalRatePerDay = 0,
  penetrationFeetPerDay = 600,
  contingencyShare = 0.1,
  ...options
}) {
  const sections = programme.sections.map((section) => {
    if (section.holeSizeInches === null || section.holeSizeInches === undefined) {
      throw new Error(`${section.name} has no hole size, so it cannot be planned`);
    }
    const plan = sectionPlan({ section, treatments, products, surfaceSystemBbl, ...options });
    const rate = toPositive(penetrationFeetPerDay, 'penetrationFeetPerDay');
    const days = plan.lengthFeet / rate;
    const service = days * toNonNegative(serviceRatePerDay, 'serviceRatePerDay');
    const rental = days * toNonNegative(rentalRatePerDay, 'rentalRatePerDay');
    return {
      ...plan,
      days: round(days, 1),
      serviceCost: round(service, 2),
      rentalCost: round(rental, 2),
      sectionCost: round(plan.productCost + service + rental, 2),
    };
  });
  const products_ = sections.reduce((total, section) => total + section.productCost, 0);
  const service = sections.reduce((total, section) => total + section.serviceCost, 0);
  const rental = sections.reduce((total, section) => total + section.rentalCost, 0);
  const base = products_ + service + rental;
  const contingency = base * toNonNegative(contingencyShare, 'contingencyShare');
  const footage = sections.reduce((total, section) => total + section.lengthFeet, 0);
  const days = sections.reduce((total, section) => total + section.days, 0);
  return {
    well: programme.well,
    sections,
    productCost: round(products_, 2),
    serviceCost: round(service, 2),
    rentalCost: round(rental, 2),
    baseCost: round(base, 2),
    contingency: round(contingency, 2),
    totalCost: round(base + contingency, 2),
    footageFeet: footage,
    days: round(days, 1),
    costPerFoot: round((base + contingency) / footage, 2),
  };
}

/**
 * Compare the estimate against what actually happened.
 */
export function estimateAgainstActual({ estimate, actual }) {
  const spent = toNonNegative(actual?.totalCost, 'actual totalCost');
  const drilled = toPositive(actual?.footageFeet, 'actual footageFeet');
  const overrun = spent - estimate.totalCost;
  return {
    estimatedCost: estimate.totalCost,
    actualCost: round(spent, 2),
    overrun: round(overrun, 2),
    overrunShare: round(overrun / estimate.totalCost, 3),
    estimatedPerFoot: estimate.costPerFoot,
    actualPerFoot: round(spent / drilled, 2),
    footageOver: drilled - estimate.footageFeet,
    verdict: overrun <= 0 ? 'inside the estimate' : 'over the estimate',
  };
}

/**
 * Which section carried the overrun, if the actuals are broken down.
 */
export function overrunBySection({ estimate, actualBySection }) {
  return estimate.sections
    .map((section) => {
      const spent = actualBySection[section.name];
      if (spent === undefined) {
        return { name: section.name, estimated: section.sectionCost, actual: null, overrun: null };
      }
      return {
        name: section.name,
        estimated: section.sectionCost,
        actual: round(spent, 2),
        overrun: round(spent - section.sectionCost, 2),
        share: round((spent - section.sectionCost) / section.sectionCost, 3),
      };
    })
    .sort((a, b) => (b.overrun ?? -Infinity) - (a.overrun ?? -Infinity));
}
