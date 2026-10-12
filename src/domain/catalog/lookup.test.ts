import { describe, expect, it } from 'vitest';
import { NM031 } from '../__fixtures__/pumps';
import { getPressureOption } from './pressure';
import { isRpmInRange, lookupFlow, lookupPower } from './lookup';
import { OutOfCurveRange } from '../errors';

describe('1D curve lookup with range blocking', () => {
  const p4 = getPressureOption(NM031, 'p4'); // Q = 0.02*n - 2

  it('returns the fitted flow within range (matches control points)', () => {
    // At 250 RPM: 0.02*250 - 2 = 3 m^3/h
    expect(lookupFlow(NM031, p4, 250)).toBeCloseTo(3, 6);
  });

  it('returns fitted power within range', () => {
    // power fit: 0.0015*n + 0.2 at 250 -> 0.575 kW
    expect(lookupPower(NM031, p4, 250)).toBeCloseTo(0.575, 6);
  });

  it('blocks RPM below the published minimum', () => {
    expect(() => lookupFlow(NM031, p4, 50)).toThrow(OutOfCurveRange);
  });

  it('blocks RPM above the published maximum (no clamp)', () => {
    expect(() => lookupFlow(NM031, p4, 500)).toThrow(OutOfCurveRange);
  });

  it('accepts the exact range boundaries', () => {
    expect(() => lookupFlow(NM031, p4, NM031.limits.rpmMin)).not.toThrow();
    expect(() => lookupFlow(NM031, p4, NM031.limits.rpmMax)).not.toThrow();
  });

  it('isRpmInRange reflects the published limits', () => {
    expect(isRpmInRange(NM031, 250)).toBe(true);
    expect(isRpmInRange(NM031, 50)).toBe(false);
    expect(isRpmInRange(NM031, 500)).toBe(false);
  });

  it('OutOfCurveRange carries range details', () => {
    try {
      lookupFlow(NM031, p4, 500);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(OutOfCurveRange);
      const err = e as OutOfCurveRange;
      expect(err.value).toBe(500);
      expect(err.min).toBe(100);
      expect(err.max).toBe(450);
    }
  });
});
