/**
 * Plant model for Mode 2 (separate from the PLC controller).
 *
 * The PLC knows only the nominal K and the HSC. The plant uses the REAL curve
 * at the instantaneous pump RPM, plus seeded fluctuations of pressure and
 * density, so the dosing error is observable (otherwise it would always be
 * zero). It also models the deceleration/coast that produces overshoot after
 * the RUN command drops.
 */

import { getPressureOption } from '../catalog/pressure';
import { lookupFlow, lookupPower } from '../catalog/lookup';
import type { PumpCurve } from '../catalog/types';
import type { GA800Profile } from '../ga800/model';
import { computeDrive } from '../ga800/model';
import { type EngineState, stepEngine } from '../simulation/engine';
import { ramp } from '../simulation/ramp';
import type { Rng } from './rng';

export interface PlantConfig {
  pumpCode: string;
  pressureId: string;
  commandHz: number;
  densityKgM3: number;
  motorRatedPowerKw: number;
  /** Gear reduction ratio entered by the user. */
  gearRatio: number;
  /** Std of relative pressure fluctuation (fraction of bar), e.g. 0.02. */
  pressureJitterFrac: number;
  /** Std of relative density fluctuation (fraction), e.g. 0.005. */
  densityJitterFrac: number;
}

export interface PlantState {
  engine: EngineState;
  /** Whether RUN is currently commanded (drives ramp target). */
  running: boolean;
  overload: boolean;
}

export const initialPlantState = (engine: EngineState): PlantState => ({
  engine,
  running: false,
  overload: false,
});

/**
 * Advance the plant one step. `run` is the Q0.0 command from the PLC. When run
 * is false the command Hz is 0, so the ramp (decel/coast) still produces flow
 * and pulses until the pump reaches zero RPM — this is the overshoot.
 */
export const stepPlant = (
  state: PlantState,
  run: boolean,
  pump: PumpCurve,
  profile: GA800Profile,
  config: PlantConfig,
  rng: Rng,
  dtS: number,
): PlantState => {
  const engine: EngineState = { ...state.engine };
  const pressure = getPressureOption(pump, config.pressureId);

  const commandHz = run ? config.commandHz : 0;
  const outputHz = ramp(engine.outputHz, commandHz, dtS, {
    accelTimeS: profile.accelTimeS,
    decelTimeS: profile.decelTimeS,
    maxFrequencyHz: profile.maxFrequencyHz,
  });

  const { pumpRpm } = computeDrive(outputHz, config.gearRatio);

  let flowM3h = 0;
  let requiredPowerKw = 0;
  let overload = state.overload;

  if (pumpRpm >= pump.limits.rpmMin && pumpRpm <= pump.limits.rpmMax) {
    const baseFlow = lookupFlow(pump, pressure, pumpRpm);
    requiredPowerKw = lookupPower(pump, pressure, pumpRpm);
    // Seeded multiplicative fluctuation on flow via pressure/density jitter.
    const pJit = rng.normal(1, config.pressureJitterFrac);
    const dJit = rng.normal(1, config.densityJitterFrac);
    flowM3h = baseFlow * pJit;
    // Density jitter affects the mass accumulation through the engine density.
    const effectiveDensity = config.densityKgM3 * dJit;
    if (requiredPowerKw > config.motorRatedPowerKw) overload = true;
    stepEngine(engine, outputHz, config.gearRatio, flowM3h, requiredPowerKw, effectiveDensity, dtS);
    return { engine, running: run, overload };
  }

  // Below rpmMin: idle but still advance the clock (no flow, no pulses change
  // beyond pulseHz which is ~0 at low Hz).
  stepEngine(engine, outputHz, config.gearRatio, 0, 0, config.densityKgM3, dtS);
  return { engine, running: run, overload };
};

/** True when the pump has reached zero output (fully stopped). */
export const isPumpStopped = (state: PlantState): boolean =>
  state.engine.outputHz <= 0;
