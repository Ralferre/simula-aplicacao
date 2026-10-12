/**
 * Build a SimulationRecord from a terminal snapshot plus the config context.
 * Used by the UI to persist a result when a run reaches done/fault.
 */

import { CATALOG } from '../data/catalog';
import { DEFAULT_GA800_PROFILE } from '../domain/ga800/profiles';
import type { SimulationRecord } from '../domain/simulation/record';
import type { Snapshot } from '../worker/protocol';

let seq = 0;
const genId = (): string => `rec_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export interface RecordContext {
  pressureId: string;
  pressureBar: number;
  densityKgM3: number;
  motorRatedPowerKw: number;
  totalTimeS: number;
  gearRatio: number;
  motorKw: number;
  gearboxModel: string;
  seed?: number;
}

export const buildRecord = (
  snapshot: Snapshot,
  pumpCode: string,
  ctx: RecordContext,
): SimulationRecord => ({
  id: genId(),
  mode: snapshot.mode,
  timestamp: new Date().toISOString(),
  pumpCode,
  pressureId: ctx.pressureId,
  pressureBar: ctx.pressureBar,
  catalogVersion: CATALOG.version,
  profileId: DEFAULT_GA800_PROFILE.id,
  profileVersion: DEFAULT_GA800_PROFILE.version,
  commandHz: snapshot.commandHz,
  outputHz: snapshot.outputHz,
  pulseHz: snapshot.pulseHz,
  motorRpm: snapshot.motorRpm,
  pumpRpm: snapshot.pumpRpm,
  flowM3h: snapshot.flowM3h,
  gearRatio: ctx.gearRatio,
  motorKw: ctx.motorKw,
  gearboxModel: ctx.gearboxModel,
  densityKgM3: ctx.densityKgM3,
  targetMassKg: snapshot.targetMassKg,
  massKg: snapshot.massKg,
  volumeL: snapshot.volumeL,
  kPulsesPerKg: snapshot.kPulsesPerKg,
  pulseCount: snapshot.pulseCount,
  massErrorKg: snapshot.massErrorKg,
  massErrorPercent: snapshot.massErrorPercent,
  totalTimeS: ctx.totalTimeS,
  elapsedTimeS: snapshot.timeS,
  requiredPowerKw: snapshot.requiredPowerKw,
  motorRatedPowerKw: ctx.motorRatedPowerKw,
  preset: snapshot.preset,
  preact: snapshot.preact,
  seed: ctx.seed,
  faultReason: snapshot.faultReason ?? null,
  alerts: snapshot.alerts,
});
