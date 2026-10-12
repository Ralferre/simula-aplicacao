import type { Snapshot } from '../../worker/protocol';

const fmt = (n: number | null | undefined, digits = 2): string =>
  n == null ? '—' : n.toFixed(digits);

interface TelemetryProps {
  snapshot: Snapshot | null;
}

const Card = ({ label, value, unit }: { label: string; value: string; unit?: string }) => (
  <div className="telemetry-card">
    <span className="telemetry-label">{label}</span>
    <span className="telemetry-value">
      {value}
      {unit && <span className="telemetry-unit"> {unit}</span>}
    </span>
  </div>
);

/** Real-time telemetry cards fed by worker snapshots. */
export const Telemetry = ({ snapshot }: TelemetryProps) => {
  const s = snapshot;
  return (
    <div className="telemetry-grid">
      <Card label="Hz comandado" value={fmt(s?.commandHz, 1)} unit="Hz" />
      <Card label="Hz de saída" value={fmt(s?.outputHz, 1)} unit="Hz" />
      <Card label="Hz de pulsos" value={fmt(s?.pulseHz, 1)} unit="Hz" />
      <Card label="Pulsos acumulados" value={fmt(s?.pulseCount, 0)} />
      <Card label="RPM motor" value={fmt(s?.motorRpm, 0)} unit="rpm" />
      <Card label="RPM bomba" value={fmt(s?.pumpRpm, 0)} unit="rpm" />
      <Card label="Vazão" value={fmt(s?.flowM3h, 2)} unit="m³/h" />
      <Card label="Volume" value={fmt(s?.volumeL, 3)} unit="L" />
      <Card label="Massa" value={fmt(s?.massKg, 3)} unit="kg" />
      <Card label="Alvo" value={fmt(s?.targetMassKg, 3)} unit="kg" />
      <Card label="Potência req." value={fmt(s?.requiredPowerKw, 2)} unit="kW" />
      <Card label="K" value={fmt(s?.kPulsesPerKg, 2)} unit="p/kg" />
      <Card label="Erro massa" value={fmt(s?.massErrorKg, 3)} unit="kg" />
      <Card label="Erro %" value={fmt(s?.massErrorPercent, 2)} unit="%" />
    </div>
  );
};
