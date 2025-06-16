/**
 * The fixtures every test reaches for.
 *
 * Fourteen test files each carried their own copy of the capture helper and
 * their own readFileSync of the same example files. They had already drifted:
 * two of them captured stderr and the rest threw it away, so a command that
 * started failing quietly still passed in half of them.
 */
import { readFileSync } from 'node:fs';

/**
 * A print and fail pair that keeps what was written, for driving the command
 * line without touching standard output.
 */
export function capture() {
  const out = [];
  const err = [];
  return {
    out,
    err,
    print: (line) => out.push(String(line)),
    fail: (line) => err.push(String(line)),
    text: () => out.join('\n'),
    errors: () => err.join('\n'),
  };
}

/**
 * Read an example file by name.
 */
export function example(name) {
  return JSON.parse(readFileSync(`examples/${name}.json`, 'utf8'));
}

/** The example files, read once each. */
export const fixtures = {
  check: example('check-brazos'),
  checks: example('checks-brazos'),
  well: example('well-brazos'),
  day: example('day-brazos'),
  days: example('days-brazos'),
  programme: example('programme-brazos'),
  products: example('products'),
  treatments: example('treatments'),
  movements: example('movements'),
  opening: example('opening-stock'),
  pits: example('pits-brazos'),
  trip: example('trip-brazos'),
  kill: example('kill-brazos'),
  spread: example('solids-control'),
};
