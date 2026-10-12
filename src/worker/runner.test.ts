import { describe, expect, it } from 'vitest';
import { getPump } from '../data/catalog';
import { DEFAULT_GA800_PROFILE } from '../domain/ga800/profiles';
import {
  type Mode2Config,
  createMode2State,
  tickMode2,
} from '../domain/simulation/mode2';
import {
  advanceFrame,
  createMode2Runner,
  isTerminal,
  snapshotOf,
  stepsPerFrame,
} from './runner';
import type { RunParams } from './protocol';

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
  kNominal: 74,
  preact: 20,
  timeoutS: 600,
  seed: 42,
  pressureJitterFrac: 0.02,
  densityJitterFrac: 0.005,
};

const PARAMS: RunParams = {
  dtS: 0.01,
  snapshotHz: 25,
  speed: 1,
  pumpCode: 'NM031--01L',
};

describe('simulation runner', () => {
  it('stepsPerFrame respects dt, snapshotHz and speed', () => {
    // (1/25)/0.01 = 4 steps per frame at 1x
    expect(stepsPerFrame(PARAMS)).toBe(4);
    expect(stepsPerFrame({ ...PARAMS, speed: 10 })).toBe(40);
  });

  it('a frame-based run equals a direct domain run (determinism)', () => {
    // Frame-based via runner.
    const runner = createMode2Runner(CONFIG);
    let guard = 0;
    while (!isTerminal(runner) && guard < 100000) {
      advanceFrame(runner, PARAMS);
      guard += stepsPerFrame(PARAMS);
    }
    const workerFinal = snapshotOf(runner);

    // Direct domain run with the SAME dt, stepping one at a time.
    const pump = getPump(CONFIG.pumpCode);
    let state = createMode2State(CONFIG);
    for (let i = 0; i < 100000; i++) {
      state = tickMode2(state, pump, DEFAULT_GA800_PROFILE, PARAMS.dtS, {
        startPressed: true,
        stopNc: true,
        estopNc: true,
      });
      if (state.phase === 'DONE' || state.phase === 'FAULT') break;
    }

    expect(workerFinal.massKg).toBeCloseTo(state.plantState.engine.massKg, 10);
    expect(workerFinal.pulseCount).toBeCloseTo(state.plantState.engine.pulseCount, 10);
    expect(workerFinal.phase).toBe(state.phase);
  });

  it('produces a terminal snapshot with mass > 0', () => {
    const runner = createMode2Runner(CONFIG);
    let guard = 0;
    while (!isTerminal(runner) && guard < 100000) {
      advanceFrame(runner, PARAMS);
      guard += stepsPerFrame(PARAMS);
    }
    const snap = snapshotOf(runner);
    expect(snap.phase).toBe('DONE');
    expect(snap.massKg).toBeGreaterThan(0);
    expect(snap.preset).toBe(Math.round(CONFIG.targetMassKg * CONFIG.kNominal));
  });
});
