import { describe, it, expect } from 'vitest';
import {
  readTicket,
  ticketMovements,
  reconcileTickets,
  transitBalance,
  shortfallValue,
  daysInTransit,
  chaseList,
} from '../../src/inventory/transfer.js';

const tickets = [
  {
    ticket: 'T-1041',
    code: 'BAR',
    quantity: 40,
    from: 'brazos 14-3',
    to: 'ward 2',
    sentDate: '2025-05-10',
    receivedDate: '2025-05-11',
    receivedQuantity: 40,
  },
  {
    ticket: 'T-1042',
    code: 'PAC',
    quantity: 12,
    from: 'brazos 14-3',
    to: 'ward 2',
    sentDate: '2025-05-12',
    receivedDate: '2025-05-14',
    receivedQuantity: 10,
  },
  {
    ticket: 'T-1043',
    code: 'CAU',
    quantity: 8,
    from: 'ward 2',
    to: 'brazos 14-3',
    sentDate: '2025-05-14',
  },
];

const products = [
  { code: 'BAR', pricePerUnit: 16 },
  { code: 'PAC', pricePerUnit: 96 },
  { code: 'CAU', pricePerUnit: 42 },
];

describe('readTicket', () => {
  it('reads a ticket', () => {
    expect(readTicket(tickets[0]).quantity).toBe(40);
  });

  it('takes a ticket that has not arrived yet', () => {
    const ticket = readTicket(tickets[2]);
    expect(ticket.receivedDate).toBe(null);
    expect(ticket.receivedQuantity).toBe(null);
  });

  it('refuses a ticket for nothing', () => {
    expect(() => readTicket({ ...tickets[0], quantity: 0 })).toThrow(/must be above 0/);
  });

  it('names the field that is missing', () => {
    expect(() => readTicket({ ...tickets[0], from: '' })).toThrow(/ticket.from/);
  });
});

describe('ticketMovements', () => {
  it('makes two movements for a ticket that arrived', () => {
    const moves = ticketMovements(readTicket(tickets[0]));
    expect(moves).toHaveLength(2);
    expect(moves[0].kind).toBe('transferred');
    expect(moves[1].kind).toBe('received');
  });

  it('makes one for a ticket still on the road', () => {
    expect(ticketMovements(readTicket(tickets[2]))).toHaveLength(1);
  });

  it('books each movement on its own date', () => {
    const moves = ticketMovements(readTicket(tickets[1]));
    expect(moves[0].date).toBe('2025-05-12');
    expect(moves[1].date).toBe('2025-05-14');
  });

  it('books what actually arrived rather than what was sent', () => {
    expect(ticketMovements(readTicket(tickets[1]))[1].quantity).toBe(10);
  });

  it('names the ticket on both books', () => {
    for (const move of ticketMovements(readTicket(tickets[0]))) {
      expect(move.note).toContain('T-1041');
    }
  });
});

describe('reconcileTickets', () => {
  const result = reconcileTickets(tickets);

  it('finds the ticket that is short', () => {
    expect(result.disagreeing).toHaveLength(1);
    expect(result.disagreeing[0].ticket).toBe('T-1042');
    expect(result.disagreeing[0].shortBy).toBe(2);
  });

  it('finds the ticket still in transit', () => {
    expect(result.inTransit.map((row) => row.ticket)).toEqual(['T-1043']);
  });

  it('is not clean while a ticket disagrees', () => {
    expect(result.clean).toBe(false);
  });

  it('is clean when every ticket that arrived arrived whole', () => {
    expect(reconcileTickets([tickets[0], tickets[2]]).clean).toBe(true);
  });
});

describe('transitBalance', () => {
  const result = reconcileTickets(tickets);

  it('counts what is coming to a rig as positive', () => {
    expect(transitBalance({ tickets: result.tickets, rig: 'brazos 14-3' })).toEqual([
      { code: 'CAU', quantity: 8 },
    ]);
  });

  it('counts what is leaving as negative', () => {
    expect(transitBalance({ tickets: result.tickets, rig: 'ward 2' })).toEqual([
      { code: 'CAU', quantity: -8 },
    ]);
  });

  it('is nothing for a rig with nothing on the road', () => {
    expect(transitBalance({ tickets: result.tickets, rig: 'anadarko 7' })).toEqual([]);
  });
});

describe('shortfallValue', () => {
  it('values what did not arrive', () => {
    const value = shortfallValue({ tickets: reconcileTickets(tickets).tickets, products });
    expect(value.total).toBe(192);
    expect(value.rows[0].ticket).toBe('T-1042');
  });

  it('is nothing when every ticket arrived whole', () => {
    expect(
      shortfallValue({ tickets: reconcileTickets([tickets[0]]).tickets, products }).total
    ).toBe(0);
  });

  it('refuses a product that is not on the price list', () => {
    expect(() =>
      shortfallValue({ tickets: reconcileTickets(tickets).tickets, products: [products[0]] })
    ).toThrow(/not on the price list/);
  });
});

describe('daysInTransit and chaseList', () => {
  it('counts the days since a ticket was sent', () => {
    expect(daysInTransit({ ticket: { sentDate: '2025-05-14' }, today: '2025-05-21' })).toBe(7);
  });

  it('never counts backwards', () => {
    expect(daysInTransit({ ticket: { sentDate: '2025-05-14' }, today: '2025-05-10' })).toBe(0);
  });

  it('refuses a date it cannot read', () => {
    expect(() =>
      daysInTransit({ ticket: { sentDate: 'last tuesday' }, today: '2025-05-21' })
    ).toThrow(/a date it was sent/);
  });

  it('chases a ticket that has been out too long', () => {
    const chase = chaseList({
      tickets: reconcileTickets(tickets).tickets,
      today: '2025-05-21',
    });
    expect(chase.map((row) => row.ticket)).toEqual(['T-1043']);
  });

  it('chases nothing when nothing has been out long', () => {
    expect(chaseList({ tickets: reconcileTickets(tickets).tickets, today: '2025-05-15' })).toEqual(
      []
    );
  });
});
