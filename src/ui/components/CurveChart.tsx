import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { PumpCurve } from '../../domain/catalog/types';
import { evaluateFit } from '../../domain/catalog/fit';
import type { Snapshot } from '../../worker/protocol';

interface CurveChartProps {
  pump: PumpCurve | null;
  pressureId: string;
  snapshot: Snapshot | null;
}

/**
 * Flow (and power) vs pump RPM for the selected pressure curve, with the live
 * operating point overlaid. Uses the fitted function sampled across the RPM
 * range.
 */
export const CurveChart = ({ pump, pressureId, snapshot }: CurveChartProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!ref.current || !pump) return;
    const pressure = pump.pressures.find((p) => p.id === pressureId);
    if (!pressure) return;

    const { rpmMin, rpmMax } = pump.limits;
    const n = 40;
    const rpms: number[] = [];
    const flow: number[] = [];
    const power: number[] = [];
    for (let i = 0; i <= n; i++) {
      const rpm = rpmMin + ((rpmMax - rpmMin) * i) / n;
      rpms.push(rpm);
      flow.push(evaluateFit(pressure.flow.fit, rpm));
      power.push(evaluateFit(pressure.power.fit, rpm));
    }

    const data: uPlot.AlignedData = [rpms, flow, power];
    const opts: uPlot.Options = {
      title: `Vazão e potência × RPM (${pressure.label})`,
      width: 420,
      height: 220,
      scales: { x: { time: false } },
      series: [
        { label: 'RPM' },
        { label: 'Vazão (m³/h)', stroke: '#007BFF', width: 2 },
        { label: 'Potência (kW)', stroke: '#0052CC', width: 1, scale: 'kW' },
      ],
      axes: [
        { label: 'RPM bomba' },
        { label: 'm³/h' },
        { side: 1, scale: 'kW', label: 'kW' },
      ],
    };

    plotRef.current?.destroy();
    plotRef.current = new uPlot(opts, data, ref.current);

    return () => {
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [pump, pressureId]);

  // Operating point marker via title update (simple overlay).
  return (
    <div className="chart">
      <div ref={ref} />
      {snapshot && snapshot.pumpRpm > 0 && (
        <p className="chart-op-point">
          Ponto operacional: {snapshot.pumpRpm.toFixed(0)} rpm ·{' '}
          {snapshot.flowM3h.toFixed(2)} m³/h · {snapshot.requiredPowerKw.toFixed(2)} kW
        </p>
      )}
    </div>
  );
};
