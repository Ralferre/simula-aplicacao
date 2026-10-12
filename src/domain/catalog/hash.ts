/**
 * Deterministic content hashing for the versioned catalog.
 *
 * Uses a stable JSON serialization (sorted keys) so the hash is independent of
 * key ordering. SHA-256 via Node's crypto (available in the browser build too
 * through a lazy dynamic import fallback is not needed; catalog verification
 * runs offline in scripts and the hash is shipped in the JSON).
 */

import { createHash } from 'node:crypto';

/** Stable stringify: object keys sorted recursively. */
export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`,
  );
  return `{${entries.join(',')}}`;
};

/** SHA-256 hex digest of the stable serialization of `value`. */
export const hashContent = (value: unknown): string =>
  createHash('sha256').update(stableStringify(value)).digest('hex');
