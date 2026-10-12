import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import type { SimulationRecord } from '../domain/simulation/record';
import { DexieSimulationRepository } from './dexie-repository';

const makeRecord = (over: Partial<SimulationRecord> = {}): SimulationRecord => ({
  id: `rec_${Math.random().toString(36).slice(2)}`,
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

describe('DexieSimulationRepository', () => {
  let repo: DexieSimulationRepository;

  beforeEach(() => {
    repo = new DexieSimulationRepository(`test-${Math.random()}`);
  });

  it('creates and retrieves a series', async () => {
    const series = await repo.createSeries({
      mode: 'mode2',
      pumpCode: 'NM031--01L',
      profileId: 'ga800-default',
      profileVersion: '0.1.0-fixture',
      catalogVersion: '0.1.0-fixture',
      exported: false,
      archived: false,
    });
    expect(series.id).toBeTruthy();
    const got = await repo.getSeries(series.id);
    expect(got?.pumpCode).toBe('NM031--01L');
  });

  it('adds records and lists them grouped by series', async () => {
    const s1 = await repo.createSeries({
      mode: 'mode2',
      pumpCode: 'NM031--01L',
      profileId: 'ga800-default',
      profileVersion: '0.1.0-fixture',
      catalogVersion: '0.1.0-fixture',
      exported: false,
      archived: false,
    });
    const s2 = await repo.createSeries({
      mode: 'mode1',
      pumpCode: 'NM045--02L',
      profileId: 'ga800-default',
      profileVersion: '0.1.0-fixture',
      catalogVersion: '0.1.0-fixture',
      exported: false,
      archived: false,
    });

    await repo.addRecord(s1.id, makeRecord({ id: 'a', timestamp: '2026-01-01T00:00:01.000Z' }));
    await repo.addRecord(s1.id, makeRecord({ id: 'b', timestamp: '2026-01-01T00:00:02.000Z' }));
    await repo.addRecord(s2.id, makeRecord({ id: 'c' }));

    const r1 = await repo.listRecords(s1.id);
    expect(r1.map((r) => r.id)).toEqual(['a', 'b']);
    const r2 = await repo.listRecords(s2.id);
    expect(r2).toHaveLength(1);
    // stored seriesId is stripped from the returned record
    expect((r1[0] as unknown as { seriesId?: string }).seriesId).toBeUndefined();
  });

  it('archives a series and marks exported', async () => {
    const s = await repo.createSeries({
      mode: 'mode2',
      pumpCode: 'NM031--01L',
      profileId: 'ga800-default',
      profileVersion: '0.1.0-fixture',
      catalogVersion: '0.1.0-fixture',
      exported: false,
      archived: false,
    });
    await repo.updateSeries(s.id, { exported: true });
    await repo.archiveSeries(s.id);
    const got = await repo.getSeries(s.id);
    expect(got?.exported).toBe(true);
    expect(got?.archived).toBe(true);
  });

  it('clears records of a series', async () => {
    const s = await repo.createSeries({
      mode: 'mode2',
      pumpCode: 'NM031--01L',
      profileId: 'ga800-default',
      profileVersion: '0.1.0-fixture',
      catalogVersion: '0.1.0-fixture',
      exported: false,
      archived: false,
    });
    await repo.addRecord(s.id, makeRecord());
    await repo.clearRecords(s.id);
    expect(await repo.listRecords(s.id)).toHaveLength(0);
  });

  it('lists series newest first', async () => {
    const a = await repo.createSeries({
      mode: 'mode1', pumpCode: 'P', profileId: 'g', profileVersion: '1',
      catalogVersion: '1', exported: false, archived: false,
    });
    await new Promise((r) => setTimeout(r, 5));
    const b = await repo.createSeries({
      mode: 'mode2', pumpCode: 'P', profileId: 'g', profileVersion: '1',
      catalogVersion: '1', exported: false, archived: false,
    });
    const list = await repo.listSeries();
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it('deleteSeries removes the series and all its records', async () => {
    const s = await repo.createSeries({
      mode: 'mode2', pumpCode: 'NM031--01L', profileId: 'g', profileVersion: '1',
      catalogVersion: '1', exported: false, archived: false,
    });
    await repo.addRecord(s.id, makeRecord({ id: 'x' }));
    await repo.addRecord(s.id, makeRecord({ id: 'y' }));
    await repo.deleteSeries(s.id);
    expect(await repo.getSeries(s.id)).toBeUndefined();
    expect(await repo.listRecords(s.id)).toHaveLength(0);
    expect(await repo.listSeries()).toHaveLength(0);
  });

  it('deleteAllSeries clears every series and record', async () => {
    const s1 = await repo.createSeries({
      mode: 'mode1', pumpCode: 'A', profileId: 'g', profileVersion: '1',
      catalogVersion: '1', exported: false, archived: false,
    });
    const s2 = await repo.createSeries({
      mode: 'mode2', pumpCode: 'B', profileId: 'g', profileVersion: '1',
      catalogVersion: '1', exported: false, archived: false,
    });
    await repo.addRecord(s1.id, makeRecord({ id: 'r1' }));
    await repo.addRecord(s2.id, makeRecord({ id: 'r2' }));
    await repo.deleteAllSeries();
    expect(await repo.listSeries()).toHaveLength(0);
    expect(await repo.listRecords(s1.id)).toHaveLength(0);
    expect(await repo.listRecords(s2.id)).toHaveLength(0);
  });
});
