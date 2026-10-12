import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Snapshot } from '../../worker/protocol';

interface PulseChartProps {
  history: Snapshot[];
}

/**
 * Accumulated pulses vs time, with preset and preset-preact reference lines in
 * Mode 2. Data is already decimated by the worker (one point per snapshot).
 */
export const PulseChart = ({ history }: PulseChartProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const t = history.map((s) => s.timeS);
    const pulses = history.map((s) => s.pulseCount);
    const last = history[history.length - 1];
    const preset = last?.preset;
    const presetMinusPreact =
      last?.preset != null && last?.preact != null ? last.preset - last.preact : undefined;

    const presetLine = preset != null ? t.map(() => preset) : null;
    const cutLine = presetMinusPreact != null ? t.map(() => presetMinusPreact) : null;

    const data: uPlot.AlignedData = [
      t,
      pulses,
      ...(presetLine ? [presetLine] : []),
      ...(cutLine ? [cutLine] : []),
    ];

    const series: uPlot.Series[] = [
      { label: 't (s)' },
      { label: 'Pulsos', stroke: '#007BFF', width: 2 },
    ];
    if (presetLine) series.push({ label: 'Preset', stroke: '#8892b0', dash: [6, 3] });
    if (cutLine) series.push({ label: 'Preset − preact', stroke: '#f0b429', dash: [4, 4] });

    const opts: uPlot.Options = {
      title: 'Pulsos acumulados × tempo',
      width: 420,
      height: 220,
      scales: { x: { time: false } },
      series,
      axes: [{ label: 'tempo (s)' }, { label: 'pulsos' }],
    };

    plotRef.current?.destroy();
    plotRef.current = new uPlot(opts, data, ref.current);

    return () => {
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [history]);

  return (
    <div className="chart">
      <div ref={ref} />
    </div>
  );
};
