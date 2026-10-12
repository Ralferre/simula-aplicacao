/**
 * Typed message protocol between the UI and the simulation Web Worker.
 *
 * The worker runs a fixed-step loop at full resolution and emits decimated
 * snapshots to the UI at a limited rate (snapshotHz). Determinism lives in the
 * pure domain, so a worker run and a direct domain run with the same inputs
 * produce identical results.
 */

import type { Mode1Config } from '../domain/simulation/mode1';
import type { Mode2Config } from '../domain/simulation/mode2';

export interface Snapshot {
  mode: 'mode1' | 'mode2';
  phase: string;
  timeS: number;
  outputHz: number;
  commandHz: number;
  pulseHz: number;
  motorRpm: number;
  pumpRpm: number;
  flowM3h: number;
  volumeL: number;
  massKg: number;
  pulseCount: number;
  hsc: number;
  requiredPowerKw: number;
  kPulsesPerKg: number | null;
  targetMassKg: number;
  massErrorKg: number;
  massErrorPercent: number;
  powerInsufficient: boolean;
  alerts: string[];
  /** Mode 2 only. */
  preset?: number;
  preact?: number;
  faultReason?: string | null;
}

export interface RunParams {
  /** Fixed physics step in seconds (default 0.001 = 1 ms). */
  dtS: number;
  /** Snapshot emission rate in Hz (default 25). */
  snapshotHz: number;
  /** Simulated clock speed multiplier (1x or 10x). Affects steps per frame. */
  speed: number;
  pumpCode: string;
}

export type WorkerCommand =
  | { type: 'start-mode1'; config: Mode1Config; params: RunParams }
  | { type: 'start-mode2'; config: Mode2Config; params: RunParams }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }
  | { type: 'stop' };

export type WorkerEvent =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'done'; snapshot: Snapshot }
  | { type: 'fault'; snapshot: Snapshot }
  | { type: 'error'; message: string };
