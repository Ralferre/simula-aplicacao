import { describe, expect, it } from 'vitest';
import { NM031 } from '../__fixtures__/pumps';
import { DEFAULT_GA800_PROFILE } from '../ga800/profiles';
import { initialEngineState } from '../simulation/engine';
import {
  type PlantConfig,
  initialPlantState,
  isPumpStopped,
  stepPlant,
} from './plant';
import { createRng } from './rng';

const CONFIG: PlantConfig = {
  pumpCode: 'NM031--01L',
  pressureId: 'p4',
  commandHz: 60,
  densityKgM3: 1000,
  motorRatedPowerKw: 5,
  gearRatio: 4,
  pressureJitterFrac: 0.02,
  densityJitterFrac: 0.005,
};

// Fast ramps so the pump reaches range quickly in tests.
const profile = { ...DEFAULT_GA800_PROFILE, accelTimeS: 0.5, decelTimeS: 0.5 };

const run = (seed: number, steps: number) => {
  let state = initialPlantState(initialEngineState());
  const rng = createRng(seed);
  for (let i = 0; i < steps; i++) {
    state = stepPlant(state, true, NM031, profile, CONFIG, rng, 0.1);
  }
  return state;
};

describe('plant model', () => {
  it('is reproducible for the same seed', () => {
    const a = run(123, 50);
    const b = run(123, 50);
    expect(a.engine.volumeL).toBe(b.engine.volumeL);
    expect(a.engine.pulseCount).toBe(b.engine.pulseCount);
  });

  it('differs across seeds (fluctuation is active)', () => {
    const a = run(1, 50);
    const b = run(2, 50);
    expect(a.engine.volumeL).not.toBe(b.engine.volumeL);
  });

  it('produces overshoot after RUN drops (decel still pumps)', () => {
    // Spin up to running first.
    let state = initialPlantState(initialEngineState());
    const rng = createRng(5);
    for (let i = 0; i < 20; i++) {
      state = stepPlant(state, true, NM031, profile, CONFIG, rng, 0.1);
    }
    const volAtCut = state.engine.volumeL;
    // Now RUN drops: deceleration still produces flow until outputHz hits 0.
    for (let i = 0; i < 20; i++) {
      state = stepPlant(state, false, NM031, profile, CONFIG, rng, 0.1);
    }
    expect(state.engine.volumeL).toBeGreaterThan(volAtCut);
    expect(isPumpStopped(state)).toBe(true);
  });
});
