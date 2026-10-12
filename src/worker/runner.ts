/**
 * Pure simulation runner shared by the Web Worker and unit tests.
 *
 * It advances a mode at the fixed step dtS and produces decimated snapshots at
 * the configured snapshotHz. Keeping this logic pure (no Worker/global APIs)
 * lets us assert that a worker run equals a direct domain run.
 */

import { getPump } from '../data/catalog';
import { getPressureOption } from '../domain/catalog/pressure';
import type { PumpCurve } from '../domain/catalog/types';
import { DEFAULT_GA800_PROFILE } from '../domain/ga800/profiles';
import { computeDrive } from '../domain/ga800/model';
import { hscCount } from '../domain/simulation/engine';
import {
  type Mode1Config,
  type Mode1State,
  confirmMode1,
  initialMode1State,
  startMode1,
  tickMode1,
} from '../domain/simulation/mode1';
import {
  type Mode2Config,
  type Mode2State,
  createMode2State,
  tickMode2,
} from '../domain/simulation/mode2';
import type { RunParams, Snapshot } from './protocol';

const profile = DEFAULT_GA800_PROFILE;

export interface Mode1Runner {
  kind: 'mode1';
  state: Mode1State;
  pump: PumpCurve;
  config: Mode1Config;
}

export interface Mode2Runner {
  kind: 'mode2';
  state: Mode2State;
  pump: PumpCurve;
  config: Mode2Config;
}

export type Runner = Mode1Runner | Mode2Runner;

export const createMode1Runner = (config: Mode1Config): Mode1Runner => {
  const pump = getPump(config.pumpCode);
  const state = startMode1(confirmMode1(initialMode1State(), config));
  return { kind: 'mode1', state, pump, config };
};

export const createMode2Runner = (config: Mode2Config): Mode2Runner => {
  const pump = getPump(config.pumpCode);
  const state = createMode2State(config);
  return { kind: 'mode2', state, pump, config };
};

const mode1Snapshot = (r: Mode1Runner): Snapshot => {
  const e = r.state.engine;
  const errors = r.state.errors;
  return {
    mode: 'mode1',
    phase: r.state.phase,
    timeS: e.timeS,
    outputHz: e.outputHz,
    commandHz: r.config.commandHz,
    pulseHz: e.pulseHz,
    motorRpm: e.motorRpm,
    pumpRpm: e.pumpRpm,
    flowM3h: e.flowM3h,
    volumeL: e.volumeL,
    massKg: e.massKg,
    pulseCount: e.pulseCount,
    hsc: hscCount(e),
    requiredPowerKw: e.requiredPowerKw,
    kPulsesPerKg: r.state.kPulsesPerKg,
    targetMassKg: r.config.targetMassKg,
    massErrorKg: errors?.massErrorKg ?? r.config.targetMassKg,
    massErrorPercent: errors?.massErrorPercent ?? 100,
    powerInsufficient: r.state.powerInsufficient,
    alerts: r.state.alerts,
  };
};

const mode2Snapshot = (r: Mode2Runner): Snapshot => {
  const e = r.state.plantState.engine;
  const massErrorKg = r.config.targetMassKg - e.massKg;
  const { pulseHz } = computeDrive(e.outputHz, r.config.gearRatio);
  return {
    mode: 'mode2',
    phase: r.state.phase,
    timeS: e.timeS,
    outputHz: e.outputHz,
    commandHz: r.config.commandHz,
    pulseHz,
    motorRpm: e.motorRpm,
    pumpRpm: e.pumpRpm,
    flowM3h: e.flowM3h,
    volumeL: e.volumeL,
    massKg: e.massKg,
    pulseCount: e.pulseCount,
    hsc: hscCount(e),
    requiredPowerKw: e.requiredPowerKw,
    kPulsesPerKg: r.state.kPulsesPerKg,
    targetMassKg: r.config.targetMassKg,
    massErrorKg,
    massErrorPercent:
      r.config.targetMassKg === 0 ? 0 : (massErrorKg / r.config.targetMassKg) * 100,
    powerInsufficient: r.state.plantState.overload,
    alerts: [],
    preset: r.state.preset,
    preact: r.config.preact,
    faultReason: r.state.plcMemory.faultReason,
  };
};

export const snapshotOf = (r: Runner): Snapshot =>
  r.kind === 'mode1' ? mode1Snapshot(r) : mode2Snapshot(r);

export const isTerminal = (r: Runner): boolean => {
  if (r.kind === 'mode1') return r.state.phase === 'done';
  return r.state.phase === 'DONE' || r.state.phase === 'FAULT';
};

/** Steps per snapshot frame = (1/snapshotHz) / dtS * speed. */
export const stepsPerFrame = (params: RunParams): number =>
  Math.max(1, Math.round((1 / params.snapshotHz / params.dtS) * params.speed));

/**
 * Advance the runner by one frame (many fixed steps). Mutates and returns the
 * runner. Stops early if a terminal phase is reached.
 */
export const advanceFrame = (r: Runner, params: RunParams): Runner => {
  const n = stepsPerFrame(params);
  for (let i = 0; i < n; i++) {
    if (isTerminal(r)) break;
    if (r.kind === 'mode1') {
      r.state = tickMode1(r.state, r.pump, profile, params.dtS);
    } else {
      r.state = tickMode2(r.state, r.pump, profile, params.dtS, {
        startPressed: true,
        stopNc: true,
        estopNc: true,
      });
    }
  }
  return r;
};

/** Resolve the representative pressure (bar) for a running config. */
export const runnerPressureBar = (r: Runner): number =>
  getPressureOption(r.pump, r.config.pressureId).bar;
