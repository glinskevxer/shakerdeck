/**
 * A small shape checker for the files the desk reads.
 *
 * Every input arrives as json that somebody typed, so the error has to say
 * which field on which record is wrong and what was expected. A stack trace
 * from deep inside a hydraulics calculation is no use to a mud engineer at
 * three in the morning.
 */
import { toNumber, ValueError } from '../util/number.js';

export class SchemaError extends Error {
  constructor(message, path) {
    super(path ? `${path}: ${message}` : message);
    this.name = 'SchemaError';
    this.path = path ?? null;
  }
}

function join(path, key) {
  if (!path) {
    return String(key);
  }
  return typeof key === 'number' ? `${path}[${key}]` : `${path}.${key}`;
}

/**
 * Check that a value is an object and nothing else.
 */
export function requireObject(value, path = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new SchemaError('expected an object', path);
  }
  return value;
}

/**
 * Check that a value is a list, and optionally that it is not empty.
 */
export function requireArray(value, path = '', { minimum = 0 } = {}) {
  if (!Array.isArray(value)) {
    throw new SchemaError('expected a list', path);
  }
  if (value.length < minimum) {
    throw new SchemaError(`expected at least ${minimum} entries, found ${value.length}`, path);
  }
  return value;
}

/**
 * Pull a string field out, rejecting a blank one.
 */
export function requireString(record, key, path = '') {
  const value = record?.[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SchemaError('expected a non empty string', join(path, key));
  }
  return value.trim();
}

/**
 * Pull an optional string field out.
 */
export function optionalString(record, key, fallback = null, path = '') {
  const value = record?.[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new SchemaError('expected a string', join(path, key));
  }
  return value.trim();
}

/**
 * Pull a number field out, applying a range if one is given.
 */
export function requireNumber(record, key, path = '', range = {}) {
  const where = join(path, key);
  let value;
  try {
    value = toNumber(record?.[key], where);
  } catch (error) {
    if (error instanceof ValueError) {
      throw new SchemaError(error.message.replace(`${where} `, ''), where);
    }
    throw error;
  }
  if (range.minimum !== undefined && value < range.minimum) {
    throw new SchemaError(`must not be below ${range.minimum}, found ${value}`, where);
  }
  if (range.maximum !== undefined && value > range.maximum) {
    throw new SchemaError(`must not be above ${range.maximum}, found ${value}`, where);
  }
  if (range.above !== undefined && value <= range.above) {
    throw new SchemaError(`must be above ${range.above}, found ${value}`, where);
  }
  return value;
}

/**
 * Pull an optional number field out.
 */
export function optionalNumber(record, key, fallback = null, path = '', range = {}) {
  const value = record?.[key];
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return requireNumber(record, key, path, range);
}

/**
 * Pull a value that has to be one of a known set.
 */
export function requireOneOf(record, key, allowed, path = '') {
  const where = join(path, key);
  const value = record?.[key];
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new SchemaError(`expected one of ${allowed.join(', ')}`, where);
  }
  return value;
}

/**
 * Reject a field the file should not carry, which usually means a spelling
 * mistake in a field that does exist.
 */
export function rejectUnknown(record, allowed, path = '') {
  const unknown = Object.keys(record ?? {}).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new SchemaError(`unknown field ${unknown[0]}`, path);
  }
  return record;
}

/**
 * Map over a list, naming the index that failed.
 */
export function eachRecord(list, path, reader) {
  return requireArray(list, path).map((record, index) => {
    const where = join(path, index);
    requireObject(record, where);
    return reader(record, where, index);
  });
}
