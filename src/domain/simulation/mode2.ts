/**
 * Mode 2 — PLC dosing orchestration.
 *
 * Combines the pure controller (plcScan), the seeded plant (stepPlant) and the
 * engine accumulators. The controller reads the integer HSC once per step; the
 * plant uses the real curve so the dosing error is observable. Overshoot after
 * cut-off is produced by the plant's deceleration while RUN is de-asserted.
 *
 * State mirrors the controller: Idle -> Running -> Stopping -> Done / Fault.
 * Pure and deterministic for a given seed; the caller supplies Δt.
 */

import { getPressureOption } from '../catalog/pressure';
import type { PumpCurve } from '../catalog/types';
import type { GA800Profile } from '../ga800/model';
import { computeDrive, pulsesPerKg } from '../ga800/model';
import {
  type PlcConfig,
  type PlcMemory,
  type PlcState,
  computePreset,
  initialPlcMemory,
  plcScan,
} from '../plc/controller';
import {
  type PlantConfig,
  type PlantState,
  initialPlantState,
  isPumpStopped,
  stepPlant,
} from '../plc/plant';
import { createRng, type Rng } from '../plc/rng';
import { hscCount, initialEngineState } from './engine';

export interface Mode2Config {
  pumpCode: string;
  pressureId: string;
  commandHz: number;
  targetMassKg: number;
  densityKgM3: number;
  motorRatedPowerKw: number;
  /** Gear reduction ratio entered by the user. */
  gearRatio: number;
  /** Selected motor power (kW) from the pump's motorOptions. */
  motorKw: number;
  /** Selected gearbox model (e.g. "NS 27" or "externo"). */
  gearboxModel: string;
  /** Nominal K (pulses/kg) used to compute the preset. */
  kNominal: number;
  preact: number;
  timeoutS: number;
  seed: number;
  pressureJitterFrac: number;
  densityJitterFrac: number;
}

export interface Mode2State {
  phase: PlcState;
  config: Mode2Config;
  plantState: PlantState;
  plcMemory: PlcMemory;
  preset: number;
  elapsedS: number;
  rng: Rng;
  kPulsesPerKg: number | null;
}

export const createMode2State = (config: Mode2Config): Mode2State => ({
  phase: 'IDLE',
  config,
  plantState: initialPlantState(initialEngineState()),
  plcMemory: initialPlcMemory(),
  preset: computePreset(config.targetMassKg, config.kNominal),
  elapsedS: 0,
  rng: createRng(config.seed),
  kPulsesPerKg: null,
});

const toPlantConfig = (c: Mode2Config): PlantConfig => ({
  pumpCode: c.pumpCode,
  pressureId: c.pressureId,
  commandHz: c.commandHz,
  densityKgM3: c.densityKgM3,
  motorRatedPowerKw: c.motorRatedPowerKw,
  gearRatio: c.gearRatio,
  pressureJitterFrac: c.pressureJitterFrac,
  densityJitterFrac: c.densityJitterFrac,
});

const toPlcConfig = (c: Mode2Config, preset: number): PlcConfig => ({
  preset,
  preact: c.preact,
  timeoutS: c.timeoutS,
});

/** Issue the Start command (rising edge happens on the next tick). */
export const startMode2 = (state: Mode2State): Mode2State => ({
  ...state,
  phase: 'IDLE',
  plantState: initialPlantState(initialEngineState()),
  plcMemory: initialPlcMemory(),
  elapsedS: 0,
  rng: createRng(state.config.seed),
  kPulsesPerKg: null,
});

/** Reset after Done/Fault back to Idle. */
export const resetMode2 = (state: Mode2State): Mode2State =>
  createMode2State(state.config);

/**
 * Advance one fixed step. `startPressed`/`stopNc`/`estopNc` are the operator
 * inputs for this step. Pure and deterministic.
 */
export const tickMode2 = (
  state: Mode2State,
  pump: PumpCurve,
  profile: GA800Profile,
  dtS: number,
  inputs: { startPressed: boolean; stopNc: boolean; estopNc: boolean },
): Mode2State => {
  if (state.phase === 'DONE' || state.phase === 'FAULT') return state;

  const elapsedS =
    state.plcMemory.state === 'RUNNING' || state.plcMemory.state === 'STOPPING'
      ? state.elapsedS + dtS
      : state.elapsedS;

  // Controller scan reads the integer HSC once.
  const scan = plcScan(
    {
      start: inputs.startPressed,
      stopNc: inputs.stopNc,
      estopNc: inputs.estopNc,
      hsc: hscCount(state.plantState.engine),
      pumpStopped: isPumpStopped(state.plantState),
      overload: state.plantState.overload,
      elapsedS,
    },
    state.plcMemory,
    toPlcConfig(state.config, state.preset),
  );

  // Plant advances using the RUN command from the controller.
  const plantState = stepPlant(
    state.plantState,
    scan.outputs.run,
    pump,
    profile,
    toPlantConfig(state.config),
    state.rng,
    dtS,
  );

  // Update operating K from the current point.
  let kPulsesPerKg = state.kPulsesPerKg;
  const { pulseHz } = computeDrive(plantState.engine.outputHz, state.config.gearRatio);
  if (plantState.engine.flowM3h > 0) {
    kPulsesPerKg = pulsesPerKg(pulseHz, plantState.engine.flowM3h, state.config.densityKgM3);
  }

  return {
    ...state,
    phase: scan.memory.state,
    plantState,
    plcMemory: scan.memory,
    elapsedS,
    kPulsesPerKg,
  };
};

/** Convenience: run until Done or Fault, with a step cap. Deterministic. */
export const runMode2 = (
  config: Mode2Config,
  pump: PumpCurve,
  profile: GA800Profile,
  dtS: number,
  maxSteps = 100000,
): Mode2State => {
  let state = createMode2State(config);
  for (let i = 0; i < maxSteps; i++) {
    // Start held pressed; NC inputs OK. Rising edge fires on the first tick.
    state = tickMode2(state, pump, profile, dtS, {
      startPressed: true,
      stopNc: true,
      estopNc: true,
    });
    if (state.phase === 'DONE' || state.phase === 'FAULT') break;
  }
  return state;
};

/** Resolve the representative pressure in bar for a Mode 2 config. */
export const mode2PressureBar = (config: Mode2Config, pump: PumpCurve): number =>
  getPressureOption(pump, config.pressureId).bar;
