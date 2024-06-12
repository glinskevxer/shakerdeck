/**
 * The version the command line prints. It is read from the manifest so there
 * is one place to change it and no chance of the two disagreeing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export function readVersion() {
  const manifest = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
  return manifest.version;
}

export const VERSION = readVersion();
