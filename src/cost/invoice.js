/**
 * The invoice.
 *
 * Product at the contract price, service at the day rate, rentals at whatever
 * was actually on the rig, and every line traceable back to a movement or a
 * day on the report. The client's accounts department checks the arithmetic
 * and the drilling engineer checks the quantities, so both have to hold.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { usage } from '../inventory/stock.js';

/**
 * Product lines from the movements, at the price list.
 */
export function productLines({ products, movements }) {
  return usage({ products, movements }).map((line) => ({
    kind: 'product',
    code: line.code,
    description: line.name,
    quantity: line.quantity,
    unit: line.unit,
    rate: round(line.value / line.quantity, 2),
    value: line.value,
  }));
}

/**
 * Service and rental lines from the days.
 */
export function serviceLines({ days, serviceRatePerDay, rentals = [] }) {
  const count = toPositive(days, 'days');
  const lines = [
    {
      kind: 'service',
      code: 'SVC',
      description: 'engineering service',
      quantity: count,
      unit: 'day',
      rate: round(toNonNegative(serviceRatePerDay, 'serviceRatePerDay'), 2),
      value: round(count * serviceRatePerDay, 2),
    },
  ];
  for (const rental of rentals) {
    const onHire = toNonNegative(rental.days ?? count, `${rental.code} days`);
    lines.push({
      kind: 'rental',
      code: rental.code,
      description: rental.description ?? rental.code,
      quantity: onHire,
      unit: 'day',
      rate: round(toNonNegative(rental.ratePerDay, `${rental.code} ratePerDay`), 2),
      value: round(onHire * rental.ratePerDay, 2),
    });
  }
  return lines;
}

/**
 * The whole invoice, with the tax and any discount on the end.
 */
export function buildInvoice({
  number,
  well,
  from,
  to,
  products,
  movements,
  days,
  serviceRatePerDay,
  rentals = [],
  discountShare = 0,
  taxShare = 0,
}) {
  const lines = [
    ...productLines({ products, movements }),
    ...serviceLines({ days, serviceRatePerDay, rentals }),
  ];
  const gross = lines.reduce((total, line) => total + line.value, 0);
  const discount = gross * toNonNegative(discountShare, 'discountShare');
  const net = gross - discount;
  const tax = net * toNonNegative(taxShare, 'taxShare');
  return {
    number,
    well,
    from,
    to,
    lines,
    gross: round(gross, 2),
    discount: round(discount, 2),
    net: round(net, 2),
    tax: round(tax, 2),
    total: round(net + tax, 2),
  };
}

/**
 * Check an invoice against the day reports it was built from.
 *
 * The two are worked out different ways on purpose, so a difference is a real
 * disagreement rather than the same arithmetic twice.
 */
export function reconcileInvoice({ invoice, dayTotals, toleranceShare = 0.005 }) {
  const reported = dayTotals.reduce((total, day) => total + day.total, 0);
  const difference = invoice.gross - reported;
  const tolerance = Math.abs(reported) * toNonNegative(toleranceShare, 'toleranceShare');
  return {
    invoiceGross: invoice.gross,
    reportedTotal: round(reported, 2),
    difference: round(difference, 2),
    withinTolerance: Math.abs(difference) <= tolerance,
  };
}

/**
 * What each kind of line is worth, which is the summary the client wants.
 */
export function invoiceSplit(invoice) {
  const totals = new Map();
  for (const line of invoice.lines) {
    totals.set(line.kind, (totals.get(line.kind) ?? 0) + line.value);
  }
  return [...totals.entries()]
    .map(([kind, value]) => ({
      kind,
      value: round(value, 2),
      share: invoice.gross === 0 ? 0 : round(value / invoice.gross, 3),
    }))
    .sort((a, b) => b.value - a.value);
}
