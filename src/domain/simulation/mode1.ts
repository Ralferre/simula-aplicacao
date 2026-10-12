/**
 * Mode 1 — time cycle state machine.
 *
 * States: Draft -> Confirmed -> Ready -> Running <-> Paused -> Done.
 * The cycle ends when the configured time is reached. Pulses are only generated
 * while the pump is running. On completion a record is captured; a new run only
 * starts after a new Start.
 *
 * Pure and deterministic: the caller advances the clock by supplying Δt to
 * `tick`. No wall-clock reads here.
 */

import { getPressureOption } from '../catalog/pressure';
import { lookupFlow, lookupPower } from '../catalog/lookup';
import type { PumpCurve } from '../catalog/types';
import type { GA800Profile } from '../ga800/model';
import { pulsesPerKg } from '../ga800/model';
import { computeDrive } from '../ga800/model';
import {
  type EngineState,
  type Errors,
  computeErrors,
  initialEngineState,
  stepEngine,
} from '../simulation/engine';
import { ramp } from '../simulation/ramp';

export type Mode1Phase =
  | 'draft'
  | 'confirmed'
  | 'ready'
  | 'running'
  | 'paused'
  | 'done';

/** Editable draft configuration (user form). */
export interface Mode1Config {
  pumpCode: string;
  pressureId: string;
  commandHz: number;
  targetMassKg: number;
  densityKgM3: number;
  motorRatedPowerKw: number;
  /** Gear reduction ratio entered by the user (pumpRpm = motorRpm / gearRatio). */
  gearRatio: number;
  /** Selected motor power (kW) from the pump's motorOptions. */
  motorKw: number;
  /** Selected gearbox model (e.g. "NS 27" or "externo"). */
  gearboxModel: string;
  /** Total dosing time in seconds. */
  totalTimeS: number;
}

export interface Mode1State {
  phase: Mode1Phase;
  /** Immutable confirmed config (set on confirm). */
  config: Mode1Config | null;
  engine: EngineState;
  errors: Errors | null;
  /** Operating K (pulses/kg) at the last step, with its point. */
  kPulsesPerKg: number | null;
  /** True when requiredPowerKw exceeded the motor rating at any step. */
  powerInsufficient: boolean;
  alerts: string[];
}

export const initialMode1State = (): Mode1State => ({
  phase: 'draft',
  config: null,
  engine: initialEngineState(),
  errors: null,
  kPulsesPerKg: null,
  powerInsufficient: false,
  alerts: [],
});

/** Confirm the draft into an immutable config and move to Ready. */
export const confirmMode1 = (
  state: Mode1State,
  config: Mode1Config,
): Mode1State => ({
  ...state,
  phase: 'ready',
  config: { ...config },
  engine: initialEngineState(),
  errors: null,
  kPulsesPerKg: null,
  powerInsufficient: false,
  alerts: [],
});

/** Start a run from the confirmed snapshot. */
export const startMode1 = (state: Mode1State): Mode1State => {
  if (state.phase !== 'ready' && state.phase !== 'done') return state;
  if (!state.config) return state;
  return {
    ...state,
    phase: 'running',
    engine: initialEngineState(),
    errors: null,
    powerInsufficient: false,
    alerts: [],
  };
};

export const pauseMode1 = (state: Mode1State): Mode1State =>
  state.phase === 'running' ? { ...state, phase: 'paused' } : state;

export const resumeMode1 = (state: Mode1State): Mode1State =>
  state.phase === 'paused' ? { ...state, phase: 'running' } : state;

/** Discard the current run and return to Ready (without auto-start). */
export const resetMode1 = (state: Mode1State): Mode1State =>
  state.config
    ? {
        ...state,
        phase: 'ready',
        engine: initialEngineState(),
        errors: null,
        kPulsesPerKg: null,
        powerInsufficient: false,
        alerts: [],
      }
    : initialMode1State();

/** Return the config to editing (does not affect an existing run until re-confirm). */
export const adjustMode1 = (state: Mode1State): Mode1State => ({
  ...state,
  phase: 'draft',
});

/**
 * Advance the simulation by one fixed step. Requires a pump from the catalog.
 * Returns the next state (immutable wrapper around a mutated engine clone).
 */
export const tickMode1 = (
  state: Mode1State,
  pump: PumpCurve,
  profile: GA800Profile,
  dtS: number,
): Mode1State => {
  if (state.phase !== 'running' || !state.config) return state;

  const config = state.config;
  const pressure = getPressureOption(pump, config.pressureId);

  // Clone engine to keep states immutable at the machine level.
  const engine: EngineState = { ...state.engine };

  // Ramp output Hz toward the command.
  const outputHz = ramp(engine.outputHz, config.commandHz, dtS, {
    accelTimeS: profile.accelTimeS,
    decelTimeS: profile.decelTimeS,
    maxFrequencyHz: profile.maxFrequencyHz,
  });

  // Derive pump RPM for this step to look up flow/power (blocks out of range).
  const { pumpRpm, pulseHz } = computeDrive(outputHz, config.gearRatio);

  let flowM3h = 0;
  let requiredPowerKw = 0;
  const alerts = [...state.alerts];
  let powerInsufficient = state.powerInsufficient;
  let kPulsesPerKg = state.kPulsesPerKg;

  if (pumpRpm >= pump.limits.rpmMin && pumpRpm <= pump.limits.rpmMax) {
    flowM3h = lookupFlow(pump, pressure, pumpRpm);
    requiredPowerKw = lookupPower(pump, pressure, pumpRpm);
    if (requiredPowerKw > config.motorRatedPowerKw) {
      powerInsufficient = true;
      if (!alerts.some((a) => a.includes('Potência'))) {
        alerts.push('Potência requerida excede a nominal do motor: inviável.');
      }
    }
    if (flowM3h > 0) {
      kPulsesPerKg = pulsesPerKg(pulseHz, flowM3h, config.densityKgM3);
    }
  }
  // Below rpmMin (e.g. during ramp start) flow stays 0: pump effectively idle.

  stepEngine(
    engine,
    outputHz,
    config.gearRatio,
    flowM3h,
    requiredPowerKw,
    config.densityKgM3,
    dtS,
  );

  const errors = computeErrors(engine, config.targetMassKg, config.densityKgM3);

  // End the cycle when total time is reached.
  const phase: Mode1Phase = engine.timeS >= config.totalTimeS ? 'done' : 'running';

  return {
    ...state,
    phase,
    engine,
    errors,
    kPulsesPerKg,
    powerInsufficient,
    alerts,
  };
};
