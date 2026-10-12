import { describe, expect, it } from 'vitest';
import { NM031 } from '../__fixtures__/pumps';
import {
  getPressureOption,
  listPressureOptions,
  snapToPublishedPressure,
} from './pressure';
import { PressureNotFound } from '../errors';

describe('discrete pressure selection', () => {
  it('lists the published pressure options for a pump', () => {
    const options = listPressureOptions(NM031);
    expect(options.map((o) => o.label)).toEqual(['0-2 bar', '4 bar', '6 bar']);
  });

  it('gets a pressure option by id', () => {
    expect(getPressureOption(NM031, 'p4').label).toBe('4 bar');
  });

  it('throws for an unknown pressure id', () => {
    expect(() => getPressureOption(NM031, 'nope')).toThrow(PressureNotFound);
  });

  it('snaps a continuous pressure to the nearest published option (3.7 -> 4 bar)', () => {
    const option = snapToPublishedPressure(3.7, NM031);
    expect(option.label).toBe('4 bar');
  });

  it('resolves a value inside a range label span (0.8 -> "0-2 bar")', () => {
    const option = snapToPublishedPressure(0.8, NM031);
    expect(option.label).toBe('0-2 bar');
  });

  it('snaps a value above the max to the highest option (7.5 -> 6 bar)', () => {
    const option = snapToPublishedPressure(7.5, NM031);
    expect(option.label).toBe('6 bar');
  });

  it('snaps a value just below 4 toward 4 bar (3.1 -> 4 bar)', () => {
    // Distance to representative bars: |2-3.1|=1.1, |4-3.1|=0.9 -> 4 bar.
    const option = snapToPublishedPressure(3.1, NM031);
    expect(option.label).toBe('4 bar');
  });

  it('resolves exactly 2.0 inside the "0-2 bar" span', () => {
    const option = snapToPublishedPressure(2, NM031);
    expect(option.label).toBe('0-2 bar');
  });
});
