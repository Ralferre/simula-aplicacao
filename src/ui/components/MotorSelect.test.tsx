// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NM031 } from '../../domain/__fixtures__/pumps';
import type { PumpCurve } from '../../domain/catalog/types';
import { MotorSelect } from './MotorSelect';

const bearingPump: PumpCurve = {
  ...NM031,
  code: 'NM045--02S',
  series: 'SY',
  motorOptions: [{ motorKw: 0, gearboxModel: 'externo' }],
};

describe('MotorSelect', () => {
  it('is disabled with a placeholder when no pump is selected', () => {
    render(<MotorSelect pump={null} value={0} onChange={() => {}} />);
    const select = screen.getByLabelText('Motor e motoredutor') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it('lists the motor/gearbox options of the selected monobloc pump', () => {
    render(<MotorSelect pump={NM031} value={0} onChange={() => {}} />);
    const opts = (screen.getAllByRole('option') as HTMLOptionElement[]).map((o) => o.textContent);
    expect(opts).toEqual(['1.5 kW · NS 27']);
  });

  it('shows an external-drive label for bearing series', () => {
    render(<MotorSelect pump={bearingPump} value={0} onChange={() => {}} />);
    expect(screen.getByText('Acionamento externo (polia/correia)')).toBeTruthy();
  });

  it('reflects a different pump when it changes', () => {
    const { rerender } = render(<MotorSelect pump={NM031} value={0} onChange={() => {}} />);
    expect(screen.getAllByRole('option')).toHaveLength(1);
    const multi: PumpCurve = {
      ...NM031,
      motorOptions: [
        { motorKw: 2.2, gearboxModel: 'NS 57' },
        { motorKw: 3.7, gearboxModel: 'NS 57' },
        { motorKw: 0, gearboxModel: 'externo' },
      ],
    };
    rerender(<MotorSelect pump={multi} value={0} onChange={() => {}} />);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('calls onChange with the selected index', async () => {
    const onChange = vi.fn();
    const multi: PumpCurve = {
      ...NM031,
      motorOptions: [
        { motorKw: 2.2, gearboxModel: 'NS 57' },
        { motorKw: 3.7, gearboxModel: 'NS 57' },
      ],
    };
    render(<MotorSelect pump={multi} value={0} onChange={onChange} />);
    const select = screen.getByLabelText('Motor e motoredutor') as HTMLSelectElement;
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(select, { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
