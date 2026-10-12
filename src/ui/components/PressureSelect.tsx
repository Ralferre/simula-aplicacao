import type { PumpCurve } from '../../domain/catalog/types';

interface PressureSelectProps {
  pump: PumpCurve | null;
  value: string;
  onChange: (pressureId: string) => void;
  id?: string;
}

/**
 * Discrete pressure dropdown. The options are populated from the SELECTED pump
 * (Rev01 rule): only published pressures appear, and range labels like
 * "0-2 bar" are a single option. No free-form pressure entry.
 */
export const PressureSelect = ({ pump, value, onChange, id }: PressureSelectProps) => (
  <select
    id={id}
    aria-label="Pressão de aplicação"
    value={value}
    disabled={!pump}
    onChange={(e) => onChange(e.target.value)}
  >
    {!pump && <option value="">Selecione a bomba</option>}
    {pump?.pressures.map((p) => (
      <option key={p.id} value={p.id}>
        {p.label}
      </option>
    ))}
  </select>
);
