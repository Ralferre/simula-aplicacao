/**
 * Load the versioned catalog JSON (generated offline by catalog:generate).
 * The JSON is imported as a static asset and typed as Catalog.
 */

import catalogJson from '../data/catalog.json';
import { PumpNotFound } from '../domain/errors';
import type { Catalog, PumpCurve } from '../domain/catalog/types';

export const CATALOG = catalogJson as unknown as Catalog;

export const listPumps = (): PumpCurve[] => CATALOG.pumps;

export const getPump = (code: string): PumpCurve => {
  const pump = CATALOG.pumps.find((p) => p.code === code);
  if (!pump) throw new PumpNotFound(code);
  return pump;
};
