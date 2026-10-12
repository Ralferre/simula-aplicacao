// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { Series, SimulationRepository } from '../../infra/repository';
import type { SimulationRecord } from '../../domain/simulation/record';
import { RepositoryContext } from '../RepositoryContext';
import { SeriesPage } from './SeriesPage';

/** Minimal in-memory repository for the test. */
const makeRepo = (initial: Series[]): SimulationRepository => {
  let seriesList = [...initial];
  const records = new Map<string, SimulationRecord[]>();
  return {
    createSeries: vi.fn(),
    getSeries: vi.fn(async (id) => seriesList.find((s) => s.id === id)),
    listSeries: vi.fn(async () => [...seriesList]),
    updateSeries: vi.fn(async () => {}),
    archiveSeries: vi.fn(async () => {}),
    deleteSeries: vi.fn(async (id: string) => {
      seriesList = seriesList.filter((s) => s.id !== id);
      records.delete(id);
    }),
    deleteAllSeries: vi.fn(async () => {
      seriesList = [];
      records.clear();
    }),
    addRecord: vi.fn(async () => {}),
    listRecords: vi.fn(async (id: string) => records.get(id) ?? []),
    clearRecords: vi.fn(async () => {}),
  };
};

const series: Series[] = [
  {
    id: 's1', mode: 'mode2', pumpCode: 'NM031--01L', profileId: 'g',
    profileVersion: '1', catalogVersion: '1', createdAt: '2026-01-01T00:00:00.000Z',
    exported: false, archived: false,
  },
];

const renderWith = (repo: SimulationRepository) =>
  render(
    <RepositoryContext.Provider value={repo}>
      <SeriesPage />
    </RepositoryContext.Provider>,
  );

describe('SeriesPage delete buttons', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Excluir todas" and calls deleteAllSeries on confirm', async () => {
    const repo = makeRepo(series);
    renderWith(repo);
    const btn = await screen.findByText('Excluir todas');
    fireEvent.click(btn);
    await waitFor(() => expect(repo.deleteAllSeries).toHaveBeenCalledTimes(1));
  });

  it('does not delete when the confirmation is cancelled', async () => {
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const repo = makeRepo(series);
    renderWith(repo);
    const btn = await screen.findByText('Excluir todas');
    fireEvent.click(btn);
    await waitFor(() => expect(repo.deleteAllSeries).not.toHaveBeenCalled());
  });

  it('deletes the selected series via "Excluir série"', async () => {
    const repo = makeRepo(series);
    renderWith(repo);
    // select the series first
    const seriesBtn = await screen.findByText(/NM031--01L/);
    fireEvent.click(seriesBtn);
    const del = await screen.findByText('Excluir série');
    fireEvent.click(del);
    await waitFor(() => expect(repo.deleteSeries).toHaveBeenCalledWith('s1'));
  });
});
