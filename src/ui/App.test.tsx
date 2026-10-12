// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App home / splash', () => {
  it('shows the product name and the RSoft product framing', () => {
    render(<App />);
    expect(screen.getByText('Simulador de Dosagem')).toBeTruthy();
    expect(screen.getByText('RSOFT')).toBeTruthy();
    expect(screen.getByText('Um produto RSoft')).toBeTruthy();
    expect(screen.getByText('Entrar')).toBeTruthy();
  });
});
