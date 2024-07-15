/**
 * Product stock on the rig.
 *
 * The stock report is what the client is billed off, so it has to reconcile
 * rather than merely add up. Every movement is signed, the running balance is
 * carried forward, and a balance that goes below zero is reported as an error
 * on the day it happened rather than netting out against a later delivery.
 */
import { toNonNegative, round } from '../util/number.js';
import {
  requireObject,
  requireString,
  optionalString,
  requireNumber,
  optionalNumber,
  requireOneOf,
  SchemaError,
} from '../valid/schema.js';

/** What a movement can be, and which way it moves the balance. */
export const MOVEMENT_KINDS = {
  received: 1,
  returned: -1,
  used: -1,
  transferred: -1,
  lost: -1,
};

export const UNITS = ['sack', 'drum', 'pail', 'bbl', 'pound'];

/**
 * Read a product off the price list.
 */
export function readProduct(record, path = 'product') {
  requireObject(record, path);
  return {
    code: requireString(record, 'code', path),
    name: requireString(record, 'name', path),
    unit: requireOneOf(record, 'unit', UNITS, path),
    unitPounds: optionalNumber(record, 'unitPounds', null, path, { above: 0 }),
    pricePerUnit: requireNumber(record, 'pricePerUnit', path, { minimum: 0 }),
    category: optionalString(record, 'category', 'general', path),
  };
}

/**
 * Read one movement.
 */
export function readMovement(record, path = 'movement') {
  requireObject(record, path);
  const kind = requireOneOf(record, 'kind', Object.keys(MOVEMENT_KINDS), path);
  return {
    date: requireString(record, 'date', path),
    code: requireString(record, 'code', path),
    kind,
    quantity: requireNumber(record, 'quantity', path, { minimum: 0 }),
    note: optionalString(record, 'note', null, path),
  };
}

/**
 * Run a set of movements against an opening stock.
 */
export function runStock({ products, opening = {}, movements }) {
  const catalogue = new Map();
  for (const [index, record] of products.entries()) {
    const product = readProduct(record, `products[${index}]`);
    if (catalogue.has(product.code)) {
      throw new SchemaError(`${product.code} appears twice in the price list`, 'products');
    }
    catalogue.set(product.code, product);
  }
  const balances = new Map();
  for (const product of catalogue.keys()) {
    balances.set(product, toNonNegative(opening[product] ?? 0, `opening ${product}`));
  }
  const rows = [];
  const errors = [];
  const sorted = movements
    .map((record, index) => readMovement(record, `movements[${index}]`))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const movement of sorted) {
    if (!catalogue.has(movement.code)) {
      throw new SchemaError(`${movement.code} is not on the price list`, 'movements');
    }
    const sign = MOVEMENT_KINDS[movement.kind];
    const balance = balances.get(movement.code) + sign * movement.quantity;
    balances.set(movement.code, balance);
    const row = { ...movement, balance: round(balance, 2) };
    rows.push(row);
    if (balance < 0) {
      errors.push(
        `${movement.date}: ${movement.code} went to ${round(balance, 2)}, which cannot happen`
      );
    }
  }
  return {
    movements: rows,
    closing: [...balances.entries()]
      .map(([code, balance]) => ({
        code,
        name: catalogue.get(code).name,
        unit: catalogue.get(code).unit,
        openingQuantity: round(opening[code] ?? 0, 2),
        closingQuantity: round(balance, 2),
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    errors,
    reconciles: errors.length === 0,
  };
}

/**
 * What was used over the period, by product, which is the billing line.
 */
export function usage({ products, movements }) {
  const catalogue = new Map(
    products.map((record, index) => {
      const product = readProduct(record, `products[${index}]`);
      return [product.code, product];
    })
  );
  const used = new Map();
  for (const [index, record] of movements.entries()) {
    const movement = readMovement(record, `movements[${index}]`);
    if (movement.kind !== 'used') {
      continue;
    }
    used.set(movement.code, (used.get(movement.code) ?? 0) + movement.quantity);
  }
  return [...used.entries()]
    .map(([code, quantity]) => {
      const product = catalogue.get(code);
      if (!product) {
        throw new SchemaError(`${code} is not on the price list`, 'movements');
      }
      return {
        code,
        name: product.name,
        unit: product.unit,
        quantity: round(quantity, 2),
        pounds: product.unitPounds === null ? null : round(quantity * product.unitPounds, 0),
        value: round(quantity * product.pricePerUnit, 2),
      };
    })
    .sort((a, b) => b.value - a.value);
}
