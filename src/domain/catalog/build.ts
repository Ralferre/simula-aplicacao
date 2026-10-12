/**
 * Build a fitted, hashed Catalog from raw digitized points.
 * Used by scripts/generate-catalog.ts and reused in tests.
 */

import { fitCurve } from './fit';
import { hashContent } from './hash';
import type { RawCatalog, RawPump } from './raw';
import { RAW_CATALOG } from './raw';
import type { Catalog, FittedCurve, PressureOption, PumpCurve } from './types';

const buildFittedCurve = (
  points: { rpm: number; value: number }[],
): FittedCurve => ({
  points,
  fit: fitCurve(points),
});

const buildPressure = (
  raw: RawPump['pressures'][number],
): PressureOption => ({
  id: raw.id,
  label: raw.label,
  bar: raw.bar,
  minBar: raw.minBar,
  maxBar: raw.maxBar,
  flow: buildFittedCurve(raw.flowPoints),
  power: buildFittedCurve(raw.powerPoints),
});

const buildPump = (raw: RawPump): PumpCurve => ({
  code: raw.code,
  name: raw.name,
  series: raw.series,
  motorOptions: raw.motorOptions,
  limits: raw.limits,
  source: raw.source,
  pressures: raw.pressures.map(buildPressure),
});

/**
 * Build the catalog. The hash is computed over the pumps payload only (not over
 * version/generatedAt/hash) so it is stable and independently verifiable.
 */
export const buildCatalog = (
  raw: RawCatalog = RAW_CATALOG,
  generatedAt: string = new Date().toISOString(),
): Catalog => {
  const pumps = raw.pumps.map(buildPump);
  const hash = hashContent(pumps);
  return {
    version: raw.version,
    generatedAt,
    hash,
    pumps,
  };
};
