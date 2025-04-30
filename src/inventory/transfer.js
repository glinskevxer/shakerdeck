/**
 * Product moving between rigs.
 *
 * Two stock books have to agree afterwards and they usually do not, because
 * the rig sending it writes the transfer on the day the truck left and the rig
 * receiving it writes it on the day the truck arrived. The paperwork here
 * carries both dates and reconciles on the ticket rather than on the day.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { requireString, requireNumber, optionalString, requireObject } from '../valid/schema.js';

/**
 * Read one transfer ticket.
 */
export function readTicket(record, path = 'ticket') {
  requireObject(record, path);
  return {
    ticket: requireString(record, 'ticket', path),
    code: requireString(record, 'code', path),
    quantity: requireNumber(record, 'quantity', path, { above: 0 }),
    from: requireString(record, 'from', path),
    to: requireString(record, 'to', path),
    sentDate: requireString(record, 'sentDate', path),
    receivedDate: optionalString(record, 'receivedDate', null, path),
    receivedQuantity:
      record.receivedQuantity === undefined
        ? null
        : requireNumber(record, 'receivedQuantity', path, { minimum: 0 }),
  };
}

/**
 * Turn a ticket into the two movements it makes, one on each book.
 */
export function ticketMovements(ticket) {
  const out = [
    {
      date: ticket.sentDate,
      rig: ticket.from,
      code: ticket.code,
      kind: 'transferred',
      quantity: ticket.quantity,
      note: `ticket ${ticket.ticket} to ${ticket.to}`,
    },
  ];
  if (ticket.receivedDate) {
    out.push({
      date: ticket.receivedDate,
      rig: ticket.to,
      code: ticket.code,
      kind: 'received',
      quantity: ticket.receivedQuantity ?? ticket.quantity,
      note: `ticket ${ticket.ticket} from ${ticket.from}`,
    });
  }
  return out;
}

/**
 * Reconcile a book of tickets.
 */
export function reconcileTickets(records) {
  const tickets = records.map((record, index) => readTicket(record, `tickets[${index}]`));
  const rows = tickets.map((ticket) => {
    const received = ticket.receivedQuantity;
    const short = received === null ? null : round(ticket.quantity - received, 2);
    return {
      ...ticket,
      inTransit: ticket.receivedDate === null,
      shortBy: short,
      agrees: received === null ? null : short === 0,
    };
  });
  return {
    tickets: rows,
    inTransit: rows.filter((row) => row.inTransit),
    disagreeing: rows.filter((row) => row.agrees === false),
    clean: rows.every((row) => row.agrees !== false),
  };
}

/**
 * What a rig is owed or owes, by product.
 */
export function transitBalance({ tickets, rig }) {
  const balance = new Map();
  for (const ticket of tickets) {
    if (!ticket.inTransit) {
      continue;
    }
    const sign = ticket.from === rig ? -1 : ticket.to === rig ? 1 : 0;
    if (sign === 0) {
      continue;
    }
    balance.set(ticket.code, (balance.get(ticket.code) ?? 0) + sign * ticket.quantity);
  }
  return [...balance.entries()]
    .map(([code, quantity]) => ({ code, quantity: round(quantity, 2) }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * What the shortfalls are worth, which is what gets argued about.
 */
export function shortfallValue({ tickets, products }) {
  const prices = new Map(products.map((product) => [product.code, product]));
  let total = 0;
  const rows = [];
  for (const ticket of tickets) {
    if (ticket.agrees !== false) {
      continue;
    }
    const product = prices.get(ticket.code);
    if (!product) {
      throw new Error(`${ticket.code} is not on the price list`);
    }
    const value = ticket.shortBy * toNonNegative(product.pricePerUnit, 'pricePerUnit');
    total += value;
    rows.push({
      ticket: ticket.ticket,
      code: ticket.code,
      shortBy: ticket.shortBy,
      value: round(value, 2),
    });
  }
  return { rows, total: round(total, 2) };
}

/**
 * How long a ticket has been in transit, for chasing it.
 */
export function daysInTransit({ ticket, today }) {
  const sent = Date.parse(`${ticket.sentDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(sent) || Number.isNaN(now)) {
    throw new Error('a ticket needs a date it was sent and a date to count against');
  }
  return Math.max(0, Math.round((now - sent) / 86400000));
}

/**
 * Tickets that have been out too long.
 */
export function chaseList({ tickets, today, afterDays = 5 }) {
  const limit = toPositive(afterDays, 'afterDays');
  return tickets
    .filter((ticket) => ticket.inTransit)
    .map((ticket) => ({ ...ticket, days: daysInTransit({ ticket, today }) }))
    .filter((ticket) => ticket.days >= limit)
    .sort((a, b) => b.days - a.days);
}
