/**
 * Reading and writing at the edges of the command line.
 *
 * Every failure that a mud engineer can cause has to come out as one line
 * naming the file and what was wrong with it. A stack trace means nobody reads
 * the rest of the message.
 */
import { readFileSync, writeFileSync } from 'node:fs';

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

/**
 * Read a json file, naming the file in every failure.
 */
export function readJson(path) {
  if (!path) {
    throw new UsageError('no file was given');
  }
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new UsageError(`there is no file at ${path}`);
    }
    if (error.code === 'EISDIR') {
      throw new UsageError(`${path} is a directory, not a file`);
    }
    throw new UsageError(`${path} could not be read: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new UsageError(`${path} is not valid json: ${error.message}`);
  }
}

/**
 * Write a file, naming it in the failure.
 */
export function writeText(path, text) {
  try {
    writeFileSync(path, text, 'utf8');
  } catch (error) {
    throw new UsageError(`${path} could not be written: ${error.message}`);
  }
  return path;
}

/**
 * Render a result either as lines of text or as json, which is what the
 * option on every command switches between.
 */
export function render(result, { format = 'text' } = {}) {
  if (format === 'json') {
    return JSON.stringify(result.data ?? result, null, 2);
  }
  if (Array.isArray(result.lines)) {
    return result.lines.join('\n');
  }
  return String(result);
}
