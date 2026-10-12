import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../worker/protocol';
import { resolveVisualState } from './StatusBadge';

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  mode: 'mode1',
  phase: 'running',
  timeS: 1,
  outputHz: 60,
  commandHz: 60,
  pulseHz: 144,
  motorRpm: 1800,
  pumpRpm: 450,
  flowM3h: 7,
  volumeL: 1,
  massKg: 1,
  pulseCount: 100,
  hsc: 100,
  requiredPowerKw: 1,
  kPulsesPerKg: 74,
  targetMassKg: 10,
  massErrorKg: 9,
  massErrorPercent: 90,
  powerInsufficient: false,
  alerts: [],
  ...over,
});

describe('resolveVisualState', () => {
  it('maps idle to ready', () => {
    expect(resolveVisualState('idle', null, null)).toBe('ready');
  });

  it('maps running to running', () => {
    expect(resolveVisualState('running', snap(), null)).toBe('running');
  });

  it('maps STOPPING phase while running to stopping', () => {
    expect(resolveVisualState('running', snap({ phase: 'STOPPING' }), null)).toBe('stopping');
  });

  it('maps paused to paused', () => {
    expect(resolveVisualState('paused', snap(), null)).toBe('paused');
  });

  it('maps done to done', () => {
    expect(resolveVisualState('done', snap({ phase: 'done' }), null)).toBe('done');
  });

  it('maps fault to fault', () => {
    expect(resolveVisualState('fault', snap({ faultReason: 'E-stop' }), null)).toBe('fault');
  });

  it('maps out-of-range error message to out-of-range', () => {
    expect(resolveVisualState('error', null, 'pumpRpm=500 is outside the published range [100, 450]')).toBe('out-of-range');
  });

  it('maps power insufficiency to power-insufficient', () => {
    expect(resolveVisualState('running', snap({ powerInsufficient: true }), null)).toBe('power-insufficient');
  });
});
