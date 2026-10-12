/**
 * catalog:verify — recomputes the content hash of the shipped catalog JSON and
 * compares it against the stored hash. Fails (exit 1) on any mismatch, catching
 * tampering or stale generation.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashContent } from '../src/domain/catalog/hash';
import type { Catalog } from '../src/domain/catalog/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, '../src/data/catalog.json');

if (!existsSync(FILE)) {
  console.error(
    `catalog.json not found at ${FILE}. Run "npm run catalog:generate" first.`,
  );
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(FILE, 'utf8')) as Catalog;
const recomputed = hashContent(catalog.pumps);

if (recomputed !== catalog.hash) {
  console.error(
    `Catalog hash mismatch!\n  stored=${catalog.hash}\n  actual=${recomputed}\n` +
      `The catalog was modified without regenerating. Run "npm run catalog:generate".`,
  );
  process.exit(1);
}

console.log(
  `Catalog OK: version=${catalog.version}, pumps=${catalog.pumps.length}, hash=${catalog.hash}`,
);
