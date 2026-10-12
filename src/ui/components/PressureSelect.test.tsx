// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NM031 } from '../../domain/__fixtures__/pumps';
import { PressureSelect } from './PressureSelect';

describe('PressureSelect', () => {
  it('is disabled with a placeholder when no pump is selected', () => {
    render(<PressureSelect pump={null} value="" onChange={() => {}} />);
    const select = screen.getByLabelText('Pressão de aplicação') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText('Selecione a bomba')).toBeTruthy();
  });

  it('lists only the published pressures of the selected pump (range as single option)', () => {
    render(<PressureSelect pump={NM031} value="p4" onChange={() => {}} />);
    const options = screen.getAllByRole('option') as HTMLOptionElement[];
    expect(options.map((o) => o.textContent)).toEqual(['0-2 bar', '4 bar', '6 bar']);
  });

  it('reflects the pressures of a different pump when it changes', () => {
    const otherPump = {
      ...NM031,
      code: 'NMX',
      pressures: [NM031.pressures[0], NM031.pressures[2]], // only 0-2 and 6 bar
    };
    const { rerender } = render(
      <PressureSelect pump={NM031} value="p4" onChange={() => {}} />,
    );
    expect(screen.getAllByRole('option')).toHaveLength(3);
    rerender(<PressureSelect pump={otherPump} value="p0_2" onChange={() => {}} />);
    const labels = (screen.getAllByRole('option') as HTMLOptionElement[]).map(
      (o) => o.textContent,
    );
    expect(labels).toEqual(['0-2 bar', '6 bar']);
  });

  it('calls onChange with the selected pressure id', async () => {
    const onChange = vi.fn();
    render(<PressureSelect pump={NM031} value="p4" onChange={onChange} />);
    const select = screen.getByLabelText('Pressão de aplicação') as HTMLSelectElement;
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(select, { target: { value: 'p6' } });
    expect(onChange).toHaveBeenCalledWith('p6');
  });
});
