/**
 * Client-side Excel export (ExcelJS). No backend.
 *
 * Sheets: Capa, Parâmetros, Registros, Estatísticas, Notas.
 * File name: RSOFT_Dosagem_<modo>_<bomba>_<AAAAMMDD-HHmm>.xlsx
 */

import ExcelJS from 'exceljs';
import type { SimulationRecord } from '../domain/simulation/record';
import {
  type SeriesStats,
  type Suggestions,
  computeSeriesStats,
  computeSuggestions,
} from '../domain/stats/stats';
import type { Series } from '../infra/repository';

const pad = (n: number) => n.toString().padStart(2, '0');

/** Format an ISO timestamp as local pt-BR date/time for the sheet. */
const formatLocalDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
};

export const buildFileName = (
  mode: string,
  pumpCode: string,
  date = new Date(),
): string => {
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`;
  const safePump = pumpCode.replace(/[^\w-]/g, '');
  return `RSOFT_Dosagem_${mode}_${safePump}_${stamp}.xlsx`;
};

export interface ExportInput {
  series: Series;
  records: SimulationRecord[];
  catalogVersion: string;
  toleranceKg?: number;
}

/** Build the workbook (pure; separated from the download for testability). */
export const buildWorkbook = async (
  input: ExportInput,
): Promise<ExcelJS.Workbook> => {
  const { series, records } = input;
  const stats: SeriesStats = computeSeriesStats(records, {
    toleranceKg: input.toleranceKg,
  });
  const suggestions: Suggestions = computeSuggestions(records);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'RSOFT';
  wb.created = new Date();

  // Capa
  const cover = wb.addWorksheet('Capa');
  cover.getColumn(1).width = 28;
  cover.getColumn(2).width = 40;
  cover.addRow(['RSOFT — Simulador de Dosagem']);
  cover.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF007BFF' } };
  cover.addRow(['Mais que código. Soluções para o seu futuro.']);
  cover.addRow([]);
  cover.addRow(['Modo', series.mode]);
  cover.addRow(['Bomba', series.pumpCode]);
  cover.addRow(['Versão do catálogo', input.catalogVersion]);
  cover.addRow(['Perfil GA800', `${series.profileId} v${series.profileVersion}`]);
  cover.addRow(['Data', new Date().toISOString()]);

  // Parâmetros (from the first record as the confirmed config snapshot)
  const params = wb.addWorksheet('Parâmetros');
  params.columns = [
    { header: 'Parâmetro', key: 'k', width: 28 },
    { header: 'Valor', key: 'v', width: 24 },
  ];
  const first = records[0];
  if (first) {
    params.addRows([
      { k: 'Pressão (bar)', v: first.pressureBar },
      { k: 'Hz comandado', v: first.commandHz },
      { k: 'Densidade (kg/m³)', v: first.densityKgM3 },
      { k: 'Peso alvo (kg)', v: first.targetMassKg },
      { k: 'Potência nominal (kW)', v: first.motorRatedPowerKw },
      { k: 'Preset', v: first.preset ?? '—' },
      { k: 'Pré-parada', v: first.preact ?? '—' },
      { k: 'Seed', v: first.seed ?? '—' },
    ]);
  }

  // Registros
  const sheet = wb.addWorksheet('Registros');
  sheet.columns = [
    { header: 'Timestamp (local)', key: 'timestamp', width: 22 },
    { header: 'Bomba', key: 'pumpCode', width: 14 },
    { header: 'Motoredutor', key: 'gearboxModel', width: 12 },
    { header: 'Velocidade (Hz)', key: 'commandHz', width: 13 },
    { header: 'Pressão (bar)', key: 'pressureBar', width: 12 },
    { header: 'RPM bomba', key: 'pumpRpm', width: 10 },
    { header: 'Vazão (m³/h)', key: 'flowM3h', width: 12 },
    { header: 'K (p/kg)', key: 'kPulsesPerKg', width: 10 },
    { header: 'Pulsos', key: 'pulseCount', width: 10 },
    { header: 'Peso alvo (kg)', key: 'targetMassKg', width: 13 },
    { header: 'Massa (kg)', key: 'massKg', width: 10 },
    { header: 'Erro (kg)', key: 'massErrorKg', width: 10 },
    { header: 'Erro (%)', key: 'massErrorPercent', width: 10 },
    { header: 'Tempo (s)', key: 'elapsedTimeS', width: 10 },
    { header: 'Potência (kW)', key: 'requiredPowerKw', width: 12 },
    { header: 'Falha', key: 'faultReason', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: 'A1', to: 'P1' };

  const tol = input.toleranceKg;
  for (const r of records) {
    const row = sheet.addRow({
      timestamp: formatLocalDateTime(r.timestamp),
      pumpCode: r.pumpCode,
      gearboxModel: r.gearboxModel,
      commandHz: Number(r.commandHz.toFixed(1)),
      pressureBar: r.pressureBar,
      pumpRpm: Number(r.pumpRpm.toFixed(1)),
      flowM3h: Number(r.flowM3h.toFixed(3)),
      kPulsesPerKg: r.kPulsesPerKg != null ? Number(r.kPulsesPerKg.toFixed(2)) : null,
      pulseCount: Number(r.pulseCount.toFixed(0)),
      targetMassKg: Number(r.targetMassKg.toFixed(3)),
      massKg: Number(r.massKg.toFixed(3)),
      massErrorKg: Number(r.massErrorKg.toFixed(3)),
      massErrorPercent: Number(r.massErrorPercent.toFixed(2)),
      elapsedTimeS: Number(r.elapsedTimeS.toFixed(1)),
      requiredPowerKw: Number(r.requiredPowerKw.toFixed(2)),
      faultReason: r.faultReason ?? '',
    });
    // Highlight out-of-tolerance error cells.
    if (tol != null && Math.abs(r.massErrorKg) > tol) {
      row.getCell('massErrorKg').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8D7DA' },
      };
    }
  }

  // Estatísticas
  const st = wb.addWorksheet('Estatísticas');
  st.columns = [
    { header: 'Indicador', key: 'k', width: 28 },
    { header: 'Valor', key: 'v', width: 20 },
  ];
  st.getRow(1).font = { bold: true };
  st.addRows([
    { k: 'Nº de ciclos', v: stats.count },
    { k: 'Massa média (kg)', v: Number(stats.meanMassKg.toFixed(4)) },
    { k: 'Desvio padrão (kg)', v: Number(stats.stdMassKg.toFixed(4)) },
    { k: 'Mínimo (kg)', v: Number(stats.minMassKg.toFixed(4)) },
    { k: 'Máximo (kg)', v: Number(stats.maxMassKg.toFixed(4)) },
    { k: 'MAPE (%)', v: Number(stats.mapePercent.toFixed(3)) },
    { k: 'Repetibilidade (kg)', v: Number(stats.repeatabilityKg.toFixed(4)) },
    { k: 'Tendência (kg/ciclo)', v: Number(stats.errorTrendKgPerCycle.toFixed(5)) },
    { k: 'Cp', v: stats.cp != null ? Number(stats.cp.toFixed(3)) : '—' },
    { k: 'Cpk', v: stats.cpk != null ? Number(stats.cpk.toFixed(3)) : '—' },
    { k: 'Preact sugerido (pulsos)', v: suggestions.suggestedPreactPulses ?? '—' },
    { k: 'K corrigido', v: suggestions.correctedK != null ? Number(suggestions.correctedK.toFixed(3)) : '—' },
  ]);

  // Notas
  const notes = wb.addWorksheet('Notas');
  notes.getColumn(1).width = 100;
  [
    'Simulação demonstrativa. Não é leitura de GA800 físico.',
    'Curvas Netzsch referenciadas a água; fluidos viscosos geram resultado indicativo.',
    'Pressão selecionada apenas entre as curvas publicadas da bomba (sem interpolação entre pressões).',
    'Catálogo versionado com hash; validar pontos digitalizados antes de uso de engenharia.',
    'Lógica PLC simulada; Structured Text exportado requer validação no CLP real.',
  ].forEach((line) => notes.addRow([line]));

  return wb;
};

/** Build the workbook and trigger a browser download. */
export const exportSeriesToExcel = async (input: ExportInput): Promise<void> => {
  const wb = await buildWorkbook(input);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFileName(input.series.mode, input.series.pumpCode);
  a.click();
  URL.revokeObjectURL(url);
};
