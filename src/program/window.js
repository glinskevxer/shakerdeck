/**
 * The mud programme, and whether the mud is inside it.
 *
 * The programme sets a window for each property over each hole section. A
 * check outside the window is not automatically wrong, because a mud engineer
 * who has just weighted up will be outside it for a tour, but it has to appear
 * on the report and it has to say by how much.
 */
import { toNumber, round } from '../util/number.js';
import {
  requireObject,
  requireString,
  requireNumber,
  optionalNumber,
  SchemaError,
} from '../valid/schema.js';

/** The properties a programme can put a window on, and where each is read. */
export const WINDOW_PROPERTIES = {
  weightPpg: { label: 'mud weight', unit: 'ppg' },
  funnelSeconds: { label: 'funnel viscosity', unit: 's' },
  plasticViscosity: { label: 'plastic viscosity', unit: 'cP' },
  yieldPoint: { label: 'yield point', unit: 'lb/100ft2' },
  filtrateApiMl: { label: 'api filtrate', unit: 'ml' },
  ph: { label: 'ph', unit: '' },
  chlorideMgL: { label: 'chloride', unit: 'mg/l' },
  solidsPercent: { label: 'total solids', unit: '%' },
  mbtLbBbl: { label: 'methylene blue', unit: 'lb/bbl' },
  sandPercent: { label: 'sand', unit: '%' },
};

function readLimit(record, key, path) {
  const limit = record[key];
  if (limit === undefined || limit === null) {
    return null;
  }
  requireObject(limit, `${path}.${key}`);
  const low = optionalNumber(limit, 'min', null, `${path}.${key}`);
  const high = optionalNumber(limit, 'max', null, `${path}.${key}`);
  if (low === null && high === null) {
    throw new SchemaError('a window needs a min, a max, or both', `${path}.${key}`);
  }
  if (low !== null && high !== null && low > high) {
    throw new SchemaError(`a window from ${low} to ${high} runs backwards`, `${path}.${key}`);
  }
  return { min: low, max: high };
}

/**
 * Read one section of the programme.
 */
export function readSection(record, path = 'section') {
  requireObject(record, path);
  const from = requireNumber(record, 'fromFeet', path, { minimum: 0 });
  const to = requireNumber(record, 'toFeet', path, { above: from });
  const limits = {};
  requireObject(record.limits ?? {}, `${path}.limits`);
  for (const key of Object.keys(record.limits ?? {})) {
    if (!WINDOW_PROPERTIES[key]) {
      throw new SchemaError(`there is no window for ${key}`, `${path}.limits`);
    }
    limits[key] = readLimit(record.limits, key, `${path}.limits`);
  }
  return {
    name: requireString(record, 'name', path),
    fromFeet: from,
    toFeet: to,
    holeSizeInches: optionalNumber(record, 'holeSizeInches', null, path, { above: 0 }),
    limits,
  };
}

/**
 * Read a whole programme, checking that the sections join up.
 */
export function readProgramme(record, path = 'programme') {
  requireObject(record, path);
  const sections = (record.sections ?? []).map((section, index) =>
    readSection(section, `${path}.sections[${index}]`)
  );
  if (sections.length === 0) {
    throw new SchemaError('a programme needs at least one section', path);
  }
  for (let i = 1; i < sections.length; i += 1) {
    if (sections[i].fromFeet !== sections[i - 1].toFeet) {
      throw new SchemaError(
        `${sections[i].name} starts at ${sections[i].fromFeet} where ${sections[i - 1].name} ended at ${sections[i - 1].toFeet}`,
        path
      );
    }
  }
  return { well: requireString(record, 'well', path), sections };
}

/**
 * The section a depth falls in.
 */
export function sectionAt(programme, depthFeet) {
  const depth = toNumber(depthFeet, 'depthFeet');
  const section = programme.sections.find((row) => depth > row.fromFeet && depth <= row.toFeet);
  if (!section) {
    if (depth === programme.sections[0].fromFeet) {
      return programme.sections[0];
    }
    return null;
  }
  return section;
}

/**
 * Compare one reading against one window.
 */
export function compareToWindow(key, value, window) {
  if (window === null || window === undefined || value === null || value === undefined) {
    return null;
  }
  const property = WINDOW_PROPERTIES[key];
  const reading = toNumber(value, key);
  if (window.min !== null && reading < window.min) {
    return {
      property: key,
      label: property.label,
      unit: property.unit,
      value: reading,
      limit: window.min,
      side: 'below',
      byHowMuch: round(window.min - reading, 3),
    };
  }
  if (window.max !== null && reading > window.max) {
    return {
      property: key,
      label: property.label,
      unit: property.unit,
      value: reading,
      limit: window.max,
      side: 'above',
      byHowMuch: round(reading - window.max, 3),
    };
  }
  return null;
}

/**
 * Every reading on a check against the window for the depth it was taken at.
 */
export function checkAgainstWindow(readings, section) {
  const exceptions = [];
  for (const key of Object.keys(WINDOW_PROPERTIES)) {
    const exception = compareToWindow(key, readings[key], section.limits[key]);
    if (exception) {
      exceptions.push(exception);
    }
  }
  return {
    section: section.name,
    exceptions,
    inWindow: exceptions.length === 0,
  };
}
