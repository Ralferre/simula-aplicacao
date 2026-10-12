import { describe, expect, it } from 'vitest';
import type { SimulationRecord } from '../domain/simulation/record';
import type { Series } from '../infra/repository';
import { buildFileName, buildWorkbook } from './excel';

const series: Series = {
  id: 's1',
  mode: 'mode2',
  pumpCode: 'NM031--01L',
  profileId: 'ga800-default',
  profileVersion: '0.1.0-fixture',
  catalogVersion: '0.1.0-fixture',
  createdAt: '2026-01-01T00:00:00.000Z',
  exported: false,
  archived: false,
};

const makeRecord = (over: Partial<SimulationRecord> = {}): SimulationRecord => ({
  id: Math.random().toString(36).slice(2),
  mode: 'mode2',
  timestamp: '2026-01-01T00:00:00.000Z',
  pumpCode: 'NM031--01L',
  pressureId: 'p4',
  pressureBar: 4,
  catalogVersion: '0.1.0-fixture',
  profileId: 'ga800-default',
  profileVersion: '0.1.0-fixture',
  commandHz: 60,
  outputHz: 60,
  pulseHz: 144,
  motorRpm: 1800,
  pumpRpm: 450,
  flowM3h: 7,
  gearRatio: 4,
  motorKw: 1.5,
  gearboxModel: 'NS 27',
  densityKgM3: 1000,
  targetMassKg: 2,
  massKg: 1.98,
  volumeL: 1.98,
  kPulsesPerKg: 74,
  pulseCount: 146,
  massErrorKg: 0.02,
  massErrorPercent: 1,
  totalTimeS: 10,
  elapsedTimeS: 10,
  requiredPowerKw: 0.8,
  motorRatedPowerKw: 5,
  preset: 148,
  preact: 20,
  seed: 42,
  faultReason: null,
  alerts: [],
  ...over,
});

describe('buildFileName', () => {
  it('formats RSOFT_Dosagem_<mode>_<pump>_<stamp>.xlsx', () => {
    const name = buildFileName('mode2', 'NM031--01L', new Date('2026-03-04T05:06:00'));
    expect(name).toBe('RSOFT_Dosagem_mode2_NM031--01L_20260304-0506.xlsx');
  });
});

describe('buildWorkbook', () => {
  it('creates the five expected sheets', async () => {
    const wb = await buildWorkbook({
      series,
      records: [makeRecord(), makeRecord()],
      catalogVersion: '0.1.0-fixture',
      toleranceKg: 0.05,
    });
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual(['Capa', 'Parâmetros', 'Registros', 'Estatísticas', 'Notas']);
  });

  it('populates records with a header row and data rows', async () => {
    const wb = await buildWorkbook({
      series,
      records: [makeRecord({ id: 'r1' }), makeRecord({ id: 'r2' })],
      catalogVersion: '0.1.0-fixture',
    });
    const sheet = wb.getWorksheet('Registros');
    expect(sheet).toBeDefined();
    // header + 2 rows
    expect(sheet!.rowCount).toBe(3);
    expect(sheet!.getRow(1).getCell(1).value).toBe('Timestamp (local)');
  });

  it('highlights an out-of-tolerance error cell', async () => {
    const wb = await buildWorkbook({
      series,
      records: [makeRecord({ massErrorKg: 0.5 })],
      catalogVersion: '0.1.0-fixture',
      toleranceKg: 0.05,
    });
    const sheet = wb.getWorksheet('Registros')!;
    const cell = sheet.getRow(2).getCell('massErrorKg');
    expect((cell.fill as { fgColor?: { argb?: string } })?.fgColor?.argb).toBe('FFF8D7DA');
  });

  it('writes a non-empty xlsx buffer', async () => {
    const wb = await buildWorkbook({
      series,
      records: [makeRecord()],
      catalogVersion: '0.1.0-fixture',
    });
    const buffer = await wb.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
