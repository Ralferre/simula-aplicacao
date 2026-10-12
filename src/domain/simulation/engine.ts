/**
 * Fixed-step simulation core shared by both modes.
 *
 * The engine advances by a fixed Δt. Each step:
 *   outputHz        = ramp(commandHz, C1-01, C1-02, Δt)   (handled by caller or here)
 *   pulseHz         = outputHz * 2.4
 *   motorRpm        = pulseHz * 12.5
 *   pumpRpm         = motorRpm / gearRatio
 *   flowM3h         = lookupFlow(...)        (blocks out of range)
 *   requiredPowerKw = lookupPower(...)
 *   volumeL        += flowM3h * 1000 * Δt / 3600
 *   massKg          = volumeL * rho / 1000
 *   pulseCount     += pulseHz * Δt           (fractional preserved; HSC = floor)
 *
 * The core is pure and deterministic. It does not read a clock; the caller
 * supplies Δt and the commanded Hz for each step. Flow may be supplied by the
 * caller (plant model in Mode 2) or looked up directly (Mode 1).
 */

import { computeDrive } from '../ga800/model';
import { massKgFromVolumeL, volumeLFromMassKg } from '../units';

/** Mutable accumulator state advanced by the engine. */
export interface EngineState {
  timeS: number;
  outputHz: number;
  pulseHz: number;
  motorRpm: number;
  pumpRpm: number;
  flowM3h: number;
  requiredPowerKw: number;
  volumeL: number;
  massKg: number;
  /** Fractional pulse accumulator (preserved internally). */
  pulseCount: number;
}

export const initialEngineState = (): EngineState => ({
  timeS: 0,
  outputHz: 0,
  pulseHz: 0,
  motorRpm: 0,
  pumpRpm: 0,
  flowM3h: 0,
  requiredPowerKw: 0,
  volumeL: 0,
  massKg: 0,
  pulseCount: 0,
});

/** Integer pulse count exposed to the HSC. */
export const hscCount = (state: EngineState): number =>
  Math.floor(state.pulseCount);

/**
 * Advance one fixed step.
 *
 * @param state         current accumulator state (mutated and returned)
 * @param outputHz      the inverter output Hz for this step (post-ramp)
 * @param gearRatio     pump gear ratio
 * @param flowM3h       flow in m^3/h for this step (from curve or plant)
 * @param requiredPowerKw required power in kW for this step
 * @param densityKgM3   product density
 * @param dtS           fixed step in seconds
 */
export const stepEngine = (
  state: EngineState,
  outputHz: number,
  gearRatio: number,
  flowM3h: number,
  requiredPowerKw: number,
  densityKgM3: number,
  dtS: number,
): EngineState => {
  const { pulseHz, motorRpm, pumpRpm } = computeDrive(outputHz, gearRatio);

  state.timeS += dtS;
  state.outputHz = outputHz;
  state.pulseHz = pulseHz;
  state.motorRpm = motorRpm;
  state.pumpRpm = pumpRpm;
  state.flowM3h = flowM3h;
  state.requiredPowerKw = requiredPowerKw;
  state.volumeL += (flowM3h * 1000 * dtS) / 3600;
  state.massKg = massKgFromVolumeL(state.volumeL, densityKgM3);
  state.pulseCount += pulseHz * dtS;

  return state;
};

/** Set points and errors against a target mass. */
export interface Errors {
  targetVolumeL: number;
  volumeErrorL: number;
  volumeErrorPercent: number;
  massErrorKg: number;
  massErrorPercent: number;
}

export const computeErrors = (
  state: EngineState,
  targetMassKg: number,
  densityKgM3: number,
): Errors => {
  const targetVolumeL = volumeLFromMassKg(targetMassKg, densityKgM3);
  const volumeErrorL = targetVolumeL - state.volumeL;
  const massErrorKg = targetMassKg - state.massKg;
  return {
    targetVolumeL,
    volumeErrorL,
    volumeErrorPercent: targetVolumeL === 0 ? 0 : (volumeErrorL / targetVolumeL) * 100,
    massErrorKg,
    massErrorPercent: targetMassKg === 0 ? 0 : (massErrorKg / targetMassKg) * 100,
  };
};
