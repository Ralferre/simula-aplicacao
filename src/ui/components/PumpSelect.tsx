import type { PumpCurve } from '../../domain/catalog/types';

interface PumpSelectProps {
  pumps: PumpCurve[];
  value: string;
  onChange: (pumpCode: string) => void;
  id?: string;
}

export const PumpSelect = ({ pumps, value, onChange, id }: PumpSelectProps) => (
  <select
    id={id}
    aria-label="Bomba"
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    <option value="">Selecione a bomba</option>
    {pumps.map((p) => (
      <option key={p.code} value={p.code}>
        {p.name} ({p.code})
      </option>
    ))}
  </select>
);
