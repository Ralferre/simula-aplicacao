/**
 * catalog:generate — builds the versioned catalog JSON from the digitized
 * curves (scripts/data/raw-curves.json, produced by scripts/extract_curves.py)
 * merged with the motor/gearbox table (scripts/data/motor-table.ts).
 *
 * Output: src/data/catalog.json
 *
 * Design:
 *  - One catalog pump per digitized curve code (e.g. "NM015--01L").
 *  - series derived from the geometry suffix: "...S" -> bearing (SY), else BY.
 *  - motorOptions from the monobloc table by base model; bearing series and
 *    unlisted models get the single "externo" option. gearRatio is user input.
 *  - pressures come from the digitized flow/power curves (discrete per pump);
 *    the fit is recomputed here from the digitized points for auditability.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitCurve } from '../src/domain/catalog/fit';
import { hashContent } from '../src/domain/catalog/hash';
import type {
  Catalog,
  FittedCurve,
  MotorOption,
  PressureOption,
  PumpCurve,
  PumpSeries,
} from '../src/domain/catalog/types';
import { EXTERNAL_DRIVE, MONOBLOC_MOTOR_TABLE } from './data/motor-table';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(__dirname, 'data/raw-curves.json');
const OUT = resolve(__dirname, '../src/data/catalog.json');

interface RawCurve {
  pressureLabel: string;
  points: [number, number][];
  fit: { a: number; b: number; r2: number; rmse: number };
}
interface RawRecord {
  code: string;
  page: number;
  flow: RawCurve[];
  power: RawCurve[];
  needsReview: boolean;
}

/** Parse a pressure label into {id, bar, minBar, maxBar}. */
const parsePressure = (label: string): Omit<PressureOption, 'flow' | 'power'> => {
  const clean = label.replace(/bar/gi, '').trim();
  const range = clean.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/);
  if (range) {
    const lo = Number(range[1].replace(',', '.'));
    const hi = Number(range[2].replace(',', '.'));
    return {
      id: `p${range[1]}_${range[2]}`.replace(/[.,]/g, '_'),
      label,
      bar: hi,
      minBar: lo,
      maxBar: hi,
    };
  }
  const single = Number(clean.replace(',', '.'));
  return {
    id: `p${clean}`.replace(/[.,\s]/g, '_'),
    label,
    bar: single,
    minBar: single,
    maxBar: single,
  };
};

const toFitted = (c: RawCurve): FittedCurve => {
  const points = c.points.map(([rpm, value]) => ({ rpm, value }));
  // Recompute the fit from the digitized points for auditability.
  const fit = points.length >= 2 ? fitCurve(points) : { a: 0, b: 0, r2: 0, rmse: 0 };
  return { points, fit };
};

const baseModel = (code: string): string => code.slice(0, 5); // "NM015"
const geometry = (code: string): string => code.split('--')[1] ?? '';

const seriesOf = (code: string): PumpSeries =>
  geometry(code).endsWith('S') ? 'SY' : 'BY';

const motorOptionsOf = (code: string, series: PumpSeries): MotorOption[] => {
  if (series === 'SY' || series === 'SP') return [EXTERNAL_DRIVE];
  const table = MONOBLOC_MOTOR_TABLE[baseModel(code)];
  return table ? [...table, EXTERNAL_DRIVE] : [EXTERNAL_DRIVE];
};

const buildPump = (rec: RawRecord): PumpCurve => {
  const series = seriesOf(rec.code);

  // Build pressure options by matching flow and power curves by label.
  const powerByLabel = new Map(rec.power.map((p) => [p.pressureLabel, p]));
  const pressures: PressureOption[] = rec.flow
    .filter((f) => f.points.length >= 2)
    .map((f) => {
      const meta = parsePressure(f.pressureLabel);
      const power = powerByLabel.get(f.pressureLabel);
      return {
        ...meta,
        flow: toFitted(f),
        power: power ? toFitted(power) : toFitted(f), // fallback: reuse flow shape if power missing
      };
    });

  // RPM limits from the union of digitized points.
  const allRpm = rec.flow.flatMap((f) => f.points.map(([rpm]) => rpm));
  const rpmMin = allRpm.length ? Math.min(...allRpm) : 0;
  const rpmMax = allRpm.length ? Math.max(...allRpm) : 0;
  const pressureMaxBar = pressures.length
    ? Math.max(...pressures.map((p) => p.maxBar))
    : 0;

  return {
    code: rec.code,
    name: `NEMO ${rec.code}`,
    series,
    motorOptions: motorOptionsOf(rec.code, series),
    limits: {
      rpmMin: Math.round(rpmMin),
      rpmMax: Math.round(rpmMax),
      pressureMaxBar,
    },
    source: {
      document: 'NDB 106-06 (602)',
      page: rec.page,
      catalogRevision: 'Rev01.1',
      referenceFluid: 'water',
    },
    pressures,
  };
};

const raw = JSON.parse(readFileSync(RAW, 'utf8')) as RawRecord[];
// Only include records that yielded at least one usable pressure curve.
const pumps = raw
  .map(buildPump)
  .filter((p) => p.pressures.length > 0)
  .sort((a, b) => a.code.localeCompare(b.code));

const hash = hashContent(pumps);
const catalog: Catalog = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  hash,
  pumps,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

const needsReview = raw.filter((r) => r.needsReview).map((r) => r.code);
console.log(
  `Catalog generated: ${OUT}\n  version=${catalog.version}\n  pumps=${pumps.length}\n  hash=${hash}\n  needsReview(from extractor)=${needsReview.length}: ${needsReview.join(', ')}`,
);
