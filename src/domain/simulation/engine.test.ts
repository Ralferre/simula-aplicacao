import { describe, expect, it } from 'vitest';
import { ramp } from './ramp';
import {
  computeErrors,
  hscCount,
  initialEngineState,
  stepEngine,
} from './engine';

const RAMP = { accelTimeS: 2, decelTimeS: 2, maxFrequencyHz: 60 };

describe('ramp', () => {
  it('accelerates linearly toward the command', () => {
    // slope = 60/2 = 30 Hz/s; dt=0.1 -> +3 Hz per step
    expect(ramp(0, 60, 0.1, RAMP)).toBeCloseTo(3, 10);
  });

  it('does not overshoot the command when accelerating', () => {
    expect(ramp(59, 60, 1, RAMP)).toBe(60);
  });

  it('decelerates toward a lower command', () => {
    expect(ramp(60, 0, 0.1, RAMP)).toBeCloseTo(57, 10);
  });

  it('does not undershoot the command when decelerating', () => {
    expect(ramp(1, 0, 1, RAMP)).toBe(0);
  });

  it('holds when already at command', () => {
    expect(ramp(30, 30, 0.1, RAMP)).toBe(30);
  });

  it('instant ramp when time is zero', () => {
    expect(ramp(0, 60, 0.001, { ...RAMP, accelTimeS: 0 })).toBe(60);
  });
});

describe('fixed-step engine', () => {
  it('integrates volume and mass over constant flow (closed form)', () => {
    const state = initialEngineState();
    const dt = 1; // 1 s
    const flow = 3.6; // m^3/h -> 1 L/s
    // run 10 steps at 60 Hz output, gearRatio 4
    for (let i = 0; i < 10; i++) {
      stepEngine(state, 60, 4, flow, 1, 1000, dt);
    }
    // 10 s * 1 L/s = 10 L
    expect(state.volumeL).toBeCloseTo(10, 6);
    // water -> 10 kg
    expect(state.massKg).toBeCloseTo(10, 6);
  });

  it('accumulates pulses monotonically and exposes floor to HSC', () => {
    const state = initialEngineState();
    // pulseHz at 60 Hz = 144 -> per 0.1s step += 14.4
    stepEngine(state, 60, 4, 3.6, 1, 1000, 0.1);
    expect(state.pulseCount).toBeCloseTo(14.4, 6);
    expect(hscCount(state)).toBe(14);
    const before = state.pulseCount;
    stepEngine(state, 60, 4, 3.6, 1, 1000, 0.1);
    expect(state.pulseCount).toBeGreaterThan(before);
  });

  it('computes drive values from output Hz and gear ratio', () => {
    const state = initialEngineState();
    stepEngine(state, 60, 4, 3.6, 1, 1000, 0.1);
    expect(state.pulseHz).toBeCloseTo(144, 6);
    expect(state.motorRpm).toBeCloseTo(1800, 6);
    expect(state.pumpRpm).toBeCloseTo(450, 6);
  });

  it('computes set points and errors', () => {
    const state = initialEngineState();
    // produce 5 L of water -> 5 kg; target 10 kg
    for (let i = 0; i < 5; i++) stepEngine(state, 60, 4, 3.6, 1, 1000, 1);
    const errors = computeErrors(state, 10, 1000);
    expect(errors.targetVolumeL).toBeCloseTo(10, 6);
    expect(errors.volumeErrorL).toBeCloseTo(5, 6);
    expect(errors.volumeErrorPercent).toBeCloseTo(50, 6);
    expect(errors.massErrorKg).toBeCloseTo(5, 6);
    expect(errors.massErrorPercent).toBeCloseTo(50, 6);
  });
});
