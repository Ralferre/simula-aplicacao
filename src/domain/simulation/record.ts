/**
 * Shared record type captured at the end of each simulation. Used by both modes
 * and consumed by persistence, statistics and Excel export.
 */

export type SimulationMode = 'mode1' | 'mode2';

export interface SimulationRecord {
  id: string;
  mode: SimulationMode;
  timestamp: string;

  pumpCode: string;
  pressureId: string;
  pressureBar: number;
  catalogVersion: string;
  profileId: string;
  profileVersion: string;

  commandHz: number;
  outputHz: number;
  pulseHz: number;
  motorRpm: number;
  pumpRpm: number;
  flowM3h: number;

  /** Gear reduction ratio used (entered by the user). */
  gearRatio: number;
  /** Selected motor power (kW). */
  motorKw: number;
  /** Selected gearbox model (e.g. "NS 27" or "externo"). */
  gearboxModel: string;

  densityKgM3: number;
  targetMassKg: number;
  massKg: number;
  volumeL: number;

  kPulsesPerKg: number | null;
  pulseCount: number;

  massErrorKg: number;
  massErrorPercent: number;

  /** Mode 1: configured cycle time. Kept for reference. */
  totalTimeS: number;
  /**
   * Elapsed simulated time for this run:
   *  - Mode 1: the configured cycle time (run ends at totalTimeS).
   *  - Mode 2: the measured time to dose the target (until Done).
   */
  elapsedTimeS: number;
  requiredPowerKw: number;
  motorRatedPowerKw: number;

  /** Mode 2 only. */
  preset?: number;
  preact?: number;
  seed?: number;
  faultReason?: string | null;

  alerts: string[];
}
