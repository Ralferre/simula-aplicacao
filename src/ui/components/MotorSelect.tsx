import type { MotorOption, PumpCurve } from '../../domain/catalog/types';

interface MotorSelectProps {
  pump: PumpCurve | null;
  /** Selected index into pump.motorOptions. */
  value: number;
  onChange: (index: number) => void;
  id?: string;
}

const optionLabel = (m: MotorOption): string =>
  m.gearboxModel === 'externo'
    ? 'Acionamento externo (polia/correia)'
    : `${m.motorKw} kW · ${m.gearboxModel}`;

/**
 * Motor + gearbox dropdown. Options come from the SELECTED pump's motorOptions
 * (from the Netzsch tables). Bearing series expose only "externo". The numeric
 * reduction ratio is entered separately by the user (not published per NS).
 */
export const MotorSelect = ({ pump, value, onChange, id }: MotorSelectProps) => (
  <select
    id={id}
    aria-label="Motor e motoredutor"
    value={value}
    disabled={!pump}
    onChange={(e) => onChange(Number(e.target.value))}
  >
    {!pump && <option value={0}>Selecione a bomba</option>}
    {pump?.motorOptions.map((m, i) => (
      <option key={`${m.motorKw}-${m.gearboxModel}-${i}`} value={i}>
        {optionLabel(m)}
      </option>
    ))}
  </select>
);
