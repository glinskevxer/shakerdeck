/**
 * Drilled cuttings, and the mud that leaves with them.
 *
 * What goes in a skip is the rock plus whatever mud is still stuck to it. The
 * second part is the one that costs money and the one nobody measures, so the
 * desk works it from the retort on a cuttings sample and prints it beside the
 * volume of rock, which is the only way the two ever get compared.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { solidsPerFoot } from '../material/dilution.js';

/**
 * Rock made over a section, in barrels.
 */
export function rockVolume({ bitDiameterInches, footageFeet, washoutFraction = 0 }) {
  return (
    solidsPerFoot(bitDiameterInches) *
    toNonNegative(footageFeet, 'footageFeet') *
    (1 + toNonNegative(washoutFraction, 'washoutFraction'))
  );
}

/**
 * Retention on cuttings: the mud that leaves stuck to the rock.
 *
 * The retort on a cuttings sample gives the share of the discharge that is
 * liquid. That share is mud, and it left the pits.
 */
export function retentionOnCuttings({ rockBbl, liquidShare }) {
  const rock = toNonNegative(rockBbl, 'rockBbl');
  const share = toNonNegative(liquidShare, 'liquidShare');
  if (share >= 1) {
    throw new Error('a discharge that is all liquid is not cuttings');
  }
  const mud = (rock * share) / (1 - share);
  return {
    rockBbl: round(rock, 2),
    mudBbl: round(mud, 2),
    dischargeBbl: round(rock + mud, 2),
    mudPerRock: round(share / (1 - share), 3),
  };
}

/**
 * A skip or a box of discharge, for the haul off ticket.
 */
export function haulLoads({ dischargeBbl, skipBbl }) {
  const discharge = toNonNegative(dischargeBbl, 'dischargeBbl');
  const skip = toPositive(skipBbl, 'skipBbl');
  return {
    loads: Math.ceil(discharge / skip),
    lastLoadShare: discharge === 0 ? 0 : round((discharge % skip || skip) / skip, 3),
  };
}

/**
 * What a section's discharge costs, mud and haulage together.
 */
export function dischargeCost({
  rockBbl,
  liquidShare,
  mudCostPerBbl,
  haulCostPerLoad,
  skipBbl,
  disposalCostPerBbl = 0,
}) {
  const retained = retentionOnCuttings({ rockBbl, liquidShare });
  const loads = haulLoads({ dischargeBbl: retained.dischargeBbl, skipBbl });
  const mud = retained.mudBbl * toNonNegative(mudCostPerBbl, 'mudCostPerBbl');
  const haul = loads.loads * toNonNegative(haulCostPerLoad, 'haulCostPerLoad');
  const disposal = retained.dischargeBbl * toNonNegative(disposalCostPerBbl, 'disposalCostPerBbl');
  return {
    ...retained,
    loads: loads.loads,
    mudCost: round(mud, 2),
    haulCost: round(haul, 2),
    disposalCost: round(disposal, 2),
    totalCost: round(mud + haul + disposal, 2),
  };
}

/**
 * Run a set of daily haul tickets into a total, and check them against what
 * the hole should have made.
 *
 * A running total well above the hole volume means mud is going out in the
 * skips. Well below it means cuttings are going somewhere they should not.
 */
export function haulReconciliation({ tickets, expectedDischargeBbl, toleranceFraction = 0.15 }) {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    throw new Error('there are no haul tickets to reconcile');
  }
  const hauled = tickets.reduce(
    (total, ticket, index) => total + toNonNegative(ticket?.barrels, `ticket ${index + 1} barrels`),
    0
  );
  const expected = toPositive(expectedDischargeBbl, 'expectedDischargeBbl');
  const tolerance = toNonNegative(toleranceFraction, 'toleranceFraction');
  const difference = hauled - expected;
  const share = difference / expected;
  let verdict = 'as expected';
  if (share > tolerance) {
    verdict = 'more went out than the hole made';
  } else if (share < -tolerance) {
    verdict = 'less went out than the hole made';
  }
  return {
    tickets: tickets.length,
    hauledBbl: round(hauled, 2),
    expectedBbl: round(expected, 2),
    differenceBbl: round(difference, 2),
    differenceShare: round(share, 3),
    verdict,
    investigate: Math.abs(share) > tolerance,
  };
}
