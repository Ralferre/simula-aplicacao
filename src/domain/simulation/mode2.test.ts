import { describe, expect, it } from 'vitest';
import { NM031 } from '../__fixtures__/pumps';
import { DEFAULT_GA800_PROFILE } from '../ga800/profiles';
import {
  type Mode2Config,
  createMode2State,
  runMode2,
  tickMode2,
} from './mode2';

const profile = { ...DEFAULT_GA800_PROFILE, accelTimeS: 0.3, decelTimeS: 0.3 };

const CONFIG: Mode2Config = {
  pumpCode: 'NM031--01L',
  pressureId: 'p4',
  commandHz: 60,
  targetMassKg: 2,
  densityKgM3: 1000,
  motorRatedPowerKw: 5,
  gearRatio: 4,
  motorKw: 1.5,
  gearboxModel: 'NS 27',
  // nominal K ~ 74 pulses/kg at this operating point
  kNominal: 74,
  preact: 20,
  timeoutS: 600,
  seed: 42,
  pressureJitterFrac: 0.02,
  densityJitterFrac: 0.005,
};

describe('Mode 2 orchestration', () => {
  it('runs a full dosing cycle to DONE', () => {
    const final = runMode2(CONFIG, NM031, profile, 0.05);
    expect(final.phase).toBe('DONE');
    expect(final.plantState.engine.massKg).toBeGreaterThan(0);
  });

  it('is reproducible for the same seed', () => {
    const a = runMode2(CONFIG, NM031, profile, 0.05);
    const b = runMode2(CONFIG, NM031, profile, 0.05);
    expect(a.plantState.engine.massKg).toBe(b.plantState.engine.massKg);
    expect(a.plantState.engine.pulseCount).toBe(b.plantState.engine.pulseCount);
  });

  it('produces an observable dosing error (not exactly zero)', () => {
    const final = runMode2(CONFIG, NM031, profile, 0.05);
    const err = CONFIG.targetMassKg - final.plantState.engine.massKg;
    expect(Math.abs(err)).toBeGreaterThan(0);
  });

  it('faults on E-stop asserted during the run', () => {
    let state = createMode2State(CONFIG);
    // first tick: start rising edge -> RUNNING
    state = tickMode2(state, NM031, profile, 0.05, {
      startPressed: true,
      stopNc: true,
      estopNc: true,
    });
    expect(state.phase).toBe('RUNNING');
    // assert E-stop (NC false)
    state = tickMode2(state, NM031, profile, 0.05, {
      startPressed: true,
      stopNc: true,
      estopNc: false,
    });
    expect(state.phase).toBe('FAULT');
    expect(state.plcMemory.faultReason).toBe('E-stop');
  });

  it('faults on watchdog timeout', () => {
    const final = runMode2({ ...CONFIG, timeoutS: 0.1 }, NM031, profile, 0.05);
    expect(final.phase).toBe('FAULT');
    expect(final.plcMemory.faultReason).toBe('Timeout');
  });

  it('preset is computed from nominal K and target mass', () => {
    const state = createMode2State(CONFIG);
    expect(state.preset).toBe(Math.round(CONFIG.targetMassKg * CONFIG.kNominal));
  });
});
