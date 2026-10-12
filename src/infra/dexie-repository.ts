/**
 * IndexedDB adapter for SimulationRepository, using Dexie.
 *
 * Stores series and records locally in the browser. Each record is stored with
 * its owning seriesId so records can be grouped and cleared per series.
 */

import Dexie, { type Table } from 'dexie';
import type { SimulationRecord } from '../domain/simulation/record';
import type { Series, SimulationRepository } from './repository';

interface StoredRecord extends SimulationRecord {
  seriesId: string;
}

class RsoftDb extends Dexie {
  series!: Table<Series, string>;
  records!: Table<StoredRecord, string>;

  constructor(name = 'rsoft-dosagem') {
    super(name);
    this.version(1).stores({
      series: 'id, mode, pumpCode, archived, createdAt',
      records: 'id, seriesId, mode, timestamp',
    });
  }
}

let counter = 0;
const genId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export class DexieSimulationRepository implements SimulationRepository {
  private db: RsoftDb;

  constructor(name?: string) {
    this.db = new RsoftDb(name);
  }

  async createSeries(
    series: Omit<Series, 'id' | 'createdAt'>,
  ): Promise<Series> {
    const full: Series = {
      ...series,
      id: genId('series'),
      createdAt: new Date().toISOString(),
    };
    await this.db.series.add(full);
    return full;
  }

  async getSeries(id: string): Promise<Series | undefined> {
    return this.db.series.get(id);
  }

  async listSeries(): Promise<Series[]> {
    return this.db.series.orderBy('createdAt').reverse().toArray();
  }

  async updateSeries(id: string, patch: Partial<Series>): Promise<void> {
    await this.db.series.update(id, patch);
  }

  async archiveSeries(id: string): Promise<void> {
    await this.db.series.update(id, { archived: true });
  }

  async deleteSeries(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.series, this.db.records, async () => {
      await this.db.records.where('seriesId').equals(id).delete();
      await this.db.series.delete(id);
    });
  }

  async deleteAllSeries(): Promise<void> {
    await this.db.transaction('rw', this.db.series, this.db.records, async () => {
      await this.db.records.clear();
      await this.db.series.clear();
    });
  }

  async addRecord(seriesId: string, record: SimulationRecord): Promise<void> {
    await this.db.records.add({ ...record, seriesId });
  }

  async listRecords(seriesId: string): Promise<SimulationRecord[]> {
    const rows = await this.db.records
      .where('seriesId')
      .equals(seriesId)
      .toArray();
    // Deterministic order by timestamp then id.
    rows.sort((a, b) =>
      a.timestamp === b.timestamp
        ? a.id.localeCompare(b.id)
        : a.timestamp.localeCompare(b.timestamp),
    );
    // Strip the storage-only seriesId.
    return rows.map(({ seriesId: _omit, ...rest }) => rest);
  }

  async clearRecords(seriesId: string): Promise<void> {
    await this.db.records.where('seriesId').equals(seriesId).delete();
  }
}
