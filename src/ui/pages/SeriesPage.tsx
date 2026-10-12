import { useCallback, useEffect, useState } from 'react';
import { CATALOG } from '../../data/catalog';
import type { SimulationRecord } from '../../domain/simulation/record';
import { computeSeriesStats, computeSuggestions } from '../../domain/stats/stats';
import { exportSeriesToExcel } from '../../export/excel';
import type { Series } from '../../infra/repository';
import { useRepository } from '../RepositoryContext';
import { formatLocalTime } from '../formatDate';

export const SeriesPage = () => {
  const repo = useRepository();
  const [series, setSeries] = useState<Series[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [records, setRecords] = useState<SimulationRecord[]>([]);

  const refresh = useCallback(async () => {
    const list = await repo.listSeries();
    setSeries(list);
    if (selected) setRecords(await repo.listRecords(selected));
  }, [repo, selected]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = async (id: string) => {
    setSelected(id);
    setRecords(await repo.listRecords(id));
  };

  const current = series.find((s) => s.id === selected) ?? null;
  const stats = computeSeriesStats(records);
  const suggestions = computeSuggestions(records);

  const onExport = async () => {
    if (!current) return;
    await exportSeriesToExcel({
      series: current,
      records,
      catalogVersion: CATALOG.version,
    });
    await repo.updateSeries(current.id, { exported: true });
    await refresh();
  };

  const onDeleteSeries = async () => {
    if (!current) return;
    const warn = current.exported
      ? 'Excluir esta série e todos os seus registros? Esta ação não pode ser desfeita.'
      : 'Esta série AINDA NÃO foi exportada. Excluir mesmo assim? Esta ação não pode ser desfeita.';
    if (!window.confirm(warn)) return;
    await repo.deleteSeries(current.id);
    setSelected(null);
    setRecords([]);
    await refresh();
  };

  const onDeleteAll = async () => {
    if (series.length === 0) return;
    if (!window.confirm('Excluir TODAS as séries e registros? Esta ação não pode ser desfeita.')) {
      return;
    }
    await repo.deleteAllSeries();
    setSelected(null);
    setRecords([]);
    await refresh();
  };

  return (
    <section className="page">
      <div className="page-head">
        <h1>Séries e registros</h1>
      </div>
      <div className="layout">
        <div className="series-list">
          <h2>Séries</h2>
          {series.length > 0 && (
            <button type="button" className="danger" onClick={() => void onDeleteAll()}>
              Excluir todas
            </button>
          )}
          {series.length === 0 && <p>Nenhuma série ainda.</p>}
          <ul>
            {series.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={s.id === selected ? 'active' : ''}
                  onClick={() => void select(s.id)}
                >
                  {s.mode} · {s.pumpCode} {s.archived ? '(arquivada)' : ''}
                  {s.exported ? ' ✓' : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="series-detail">
          {current && (
            <>
              <div className="actions">
                <button type="button" onClick={() => void onExport()} disabled={records.length === 0}>
                  Exportar Excel
                </button>
                <button type="button" className="danger" onClick={() => void onDeleteSeries()}>
                  Excluir série
                </button>
              </div>
              <div className="stats">
                <h2>Estatística</h2>
                <ul>
                  <li>Ciclos: {stats.count}</li>
                  <li>Massa média: {stats.meanMassKg.toFixed(3)} kg</li>
                  <li>Desvio: {stats.stdMassKg.toFixed(3)} kg</li>
                  <li>MAPE: {stats.mapePercent.toFixed(2)} %</li>
                  <li>Tendência: {stats.errorTrendKgPerCycle.toFixed(4)} kg/ciclo</li>
                  <li>Preact sugerido: {suggestions.suggestedPreactPulses ?? '—'}</li>
                  <li>K corrigido: {suggestions.correctedK?.toFixed(2) ?? '—'}</li>
                </ul>
              </div>
              <table className="records">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Velocidade (Hz)</th>
                    <th>Peso alvo (kg)</th>
                    <th>Massa (kg)</th>
                    <th>Erro (kg)</th>
                    <th>Erro (%)</th>
                    <th>Tempo (s)</th>
                    <th>Pulsos</th>
                    <th>Falha</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td>{formatLocalTime(r.timestamp)}</td>
                      <td>{r.commandHz.toFixed(1)}</td>
                      <td>{r.targetMassKg.toFixed(3)}</td>
                      <td>{r.massKg.toFixed(3)}</td>
                      <td>{r.massErrorKg.toFixed(3)}</td>
                      <td>{r.massErrorPercent.toFixed(2)}</td>
                      <td>{r.elapsedTimeS.toFixed(1)}</td>
                      <td>{r.pulseCount.toFixed(0)}</td>
                      <td>{r.faultReason ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {!current && <p>Selecione uma série.</p>}
        </div>
      </div>
    </section>
  );
};
