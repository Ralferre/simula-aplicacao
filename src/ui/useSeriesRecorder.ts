import { useCallback, useRef } from 'react';
import type { SimulationMode, SimulationRecord } from '../domain/simulation/record';
import { DEFAULT_GA800_PROFILE } from '../domain/ga800/profiles';
import { CATALOG } from '../data/catalog';
import { useRepository } from './RepositoryContext';

/**
 * Persists a finished simulation into a series. A series is keyed by
 * mode + pump + profile + catalog version; the first record of a key creates
 * the series, subsequent records are appended until a new series is started.
 */
export const useSeriesRecorder = () => {
  const repo = useRepository();
  const seriesByKey = useRef<Map<string, string>>(new Map());

  const record = useCallback(
    async (mode: SimulationMode, pumpCode: string, rec: SimulationRecord) => {
      const key = `${mode}|${pumpCode}|${DEFAULT_GA800_PROFILE.id}|${CATALOG.version}`;
      let seriesId = seriesByKey.current.get(key);
      if (!seriesId) {
        const series = await repo.createSeries({
          mode,
          pumpCode,
          profileId: DEFAULT_GA800_PROFILE.id,
          profileVersion: DEFAULT_GA800_PROFILE.version,
          catalogVersion: CATALOG.version,
          exported: false,
          archived: false,
        });
        seriesId = series.id;
        seriesByKey.current.set(key, seriesId);
      }
      await repo.addRecord(seriesId, rec);
    },
    [repo],
  );

  return { record };
};
