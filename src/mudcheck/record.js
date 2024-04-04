/**
 * The mud check as it comes off the sheet.
 *
 * One record is one check on one sample at one depth. Everything on it is
 * optional except the well, the date, the depth and the weight, because a
 * check run at four in the morning while tripping will have a weight and a
 * funnel and nothing else, and refusing to read it would lose the reading.
 */
import {
  requireObject,
  requireString,
  optionalString,
  requireNumber,
  optionalNumber,
  requireOneOf,
  SchemaError,
} from '../valid/schema.js';
import { readDials } from '../rheology/dial.js';

export const SAMPLE_POINTS = ['flowline', 'suction', 'shaker', 'pit', 'cellar'];
export const BASE_TYPES = ['water', 'oil', 'synthetic'];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function readDate(record, key, path) {
  const value = requireString(record, key, path);
  if (!DATE.test(value)) {
    throw new SchemaError(`expected a date as yyyy-mm-dd, found ${value}`, `${path}.${key}`);
  }
  return value;
}

function readDialSet(record, path) {
  if (record.dials === undefined || record.dials === null) {
    return null;
  }
  requireObject(record.dials, `${path}.dials`);
  try {
    return readDials(record.dials);
  } catch (error) {
    throw new SchemaError(error.message, `${path}.dials`);
  }
}

function readGels(record, path) {
  if (record.gels === undefined || record.gels === null) {
    return null;
  }
  const where = `${path}.gels`;
  requireObject(record.gels, where);
  return {
    tenSecond: optionalNumber(record.gels, 'tenSecond', null, where, { minimum: 0 }),
    tenMinute: optionalNumber(record.gels, 'tenMinute', null, where, { minimum: 0 }),
    thirtyMinute: optionalNumber(record.gels, 'thirtyMinute', null, where, { minimum: 0 }),
  };
}

function readFiltrate(record, path) {
  if (record.filtrate === undefined || record.filtrate === null) {
    return null;
  }
  const where = `${path}.filtrate`;
  requireObject(record.filtrate, where);
  return {
    apiMl: optionalNumber(record.filtrate, 'apiMl', null, where, { minimum: 0 }),
    cakeThirtySecondInch: optionalNumber(record.filtrate, 'cakeThirtySecondInch', null, where, {
      minimum: 0,
    }),
    hthpMl: optionalNumber(record.filtrate, 'hthpMl', null, where, { minimum: 0 }),
    hthpTemperatureF: optionalNumber(record.filtrate, 'hthpTemperatureF', null, where, {
      minimum: 0,
    }),
  };
}

function readAlkalinity(record, path) {
  if (record.alkalinity === undefined || record.alkalinity === null) {
    return null;
  }
  const where = `${path}.alkalinity`;
  requireObject(record.alkalinity, where);
  return {
    pf: optionalNumber(record.alkalinity, 'pf', null, where, { minimum: 0 }),
    mf: optionalNumber(record.alkalinity, 'mf', null, where, { minimum: 0 }),
    pm: optionalNumber(record.alkalinity, 'pm', null, where, { minimum: 0 }),
  };
}

function readRetort(record, path) {
  if (record.retort === undefined || record.retort === null) {
    return null;
  }
  const where = `${path}.retort`;
  requireObject(record.retort, where);
  return {
    solidsPercent: requireNumber(record.retort, 'solidsPercent', where, {
      minimum: 0,
      maximum: 100,
    }),
    oilPercent: optionalNumber(record.retort, 'oilPercent', 0, where, { minimum: 0, maximum: 100 }),
    waterPercent: requireNumber(record.retort, 'waterPercent', where, { minimum: 0, maximum: 100 }),
  };
}

/**
 * Read one check.
 */
export function readCheck(record, path = 'check') {
  requireObject(record, path);
  const check = {
    well: requireString(record, 'well', path),
    date: readDate(record, 'date', path),
    time: optionalString(record, 'time', null, path),
    depthFeet: requireNumber(record, 'depthFeet', path, { minimum: 0 }),
    samplePoint: record.samplePoint
      ? requireOneOf(record, 'samplePoint', SAMPLE_POINTS, path)
      : 'flowline',
    base: record.base ? requireOneOf(record, 'base', BASE_TYPES, path) : 'water',
    weightPpg: requireNumber(record, 'weightPpg', path, { above: 0, maximum: 25 }),
    funnelSeconds: optionalNumber(record, 'funnelSeconds', null, path, { minimum: 0 }),
    temperatureF: optionalNumber(record, 'temperatureF', null, path, {
      minimum: -40,
      maximum: 500,
    }),
    ph: optionalNumber(record, 'ph', null, path, { minimum: 0, maximum: 14 }),
    chlorideMgL: optionalNumber(record, 'chlorideMgL', null, path, { minimum: 0 }),
    totalHardnessMgL: optionalNumber(record, 'totalHardnessMgL', null, path, { minimum: 0 }),
    sandPercent: optionalNumber(record, 'sandPercent', null, path, { minimum: 0, maximum: 100 }),
    mbtLbBbl: optionalNumber(record, 'mbtLbBbl', null, path, { minimum: 0 }),
    electricalStabilityVolts: optionalNumber(record, 'electricalStabilityVolts', null, path, {
      minimum: 0,
    }),
    dials: readDialSet(record, path),
    gels: readGels(record, path),
    filtrate: readFiltrate(record, path),
    alkalinity: readAlkalinity(record, path),
    retort: readRetort(record, path),
    note: optionalString(record, 'note', null, path),
  };
  if (check.retort) {
    const total = check.retort.solidsPercent + check.retort.oilPercent + check.retort.waterPercent;
    if (Math.abs(total - 100) > 1) {
      throw new SchemaError(
        `the retort reads ${total} percent, which is not a full cup`,
        `${path}.retort`
      );
    }
  }
  if (check.base === 'water' && check.electricalStabilityVolts !== null) {
    throw new SchemaError(
      'a water based mud has no electrical stability',
      `${path}.electricalStabilityVolts`
    );
  }
  return check;
}

/**
 * Read a list of checks, sorted oldest first so a trend reads in order.
 */
export function readChecks(list, path = 'checks') {
  if (!Array.isArray(list)) {
    throw new SchemaError('expected a list', path);
  }
  const checks = list.map((record, index) => readCheck(record, `${path}[${index}]`));
  return checks.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? -1 : 1;
    }
    return a.depthFeet - b.depthFeet;
  });
}
