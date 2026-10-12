/**
 * Persistence port (hexagonal architecture). The UI depends on this interface,
 * not on a concrete database. The IndexedDB (Dexie) adapter implements it now;
 * a Supabase adapter can implement it later without touching the domain/UI.
 */

import type { SimulationMode, SimulationRecord } from '../domain/simulation/record';

/**
 * A series groups records sharing mode + pump + profile + catalog version.
 */
export interface Series {
  id: string;
  mode: SimulationMode;
  pumpCode: string;
  profileId: string;
  profileVersion: string;
  catalogVersion: string;
  createdAt: string;
  /** True once the series has been exported to Excel. */
  exported: boolean;
  /** True once the series is closed (archived). */
  archived: boolean;
}

export interface SimulationRepository {
  createSeries(series: Omit<Series, 'id' | 'createdAt'>): Promise<Series>;
  getSeries(id: string): Promise<Series | undefined>;
  listSeries(): Promise<Series[]>;
  updateSeries(id: string, patch: Partial<Series>): Promise<void>;
  archiveSeries(id: string): Promise<void>;
  /** Permanently delete a series and all its records. */
  deleteSeries(id: string): Promise<void>;
  /** Permanently delete every series and all records. */
  deleteAllSeries(): Promise<void>;

  addRecord(seriesId: string, record: SimulationRecord): Promise<void>;
  listRecords(seriesId: string): Promise<SimulationRecord[]>;
  clearRecords(seriesId: string): Promise<void>;
}
