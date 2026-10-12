/**
 * GA800 inverter + gearbox model.
 *
 * Observed parameterization from the inverter simulator:
 *   pulseHz          = outputHz * 2.4          (H6-06/H6-07; follows real output Hz, incl. ramp)
 *   motorRpm         = pulseHz * 12.5
 *   pumpRpm          = motorRpm / gearRatio    (gearRatio belongs to the pump assembly)
 *   pulsesPerRevPump = 4.8 * gearRatio         (2.4 pulses/Hz * 12.5 RPM/pulseHz = 4.8 pulses/motor rev)
 *
 * K [pulses/kg]      = pulseHz * 3600 / (Q[m^3/h] * rho[kg/m^3])
 *
 * K is NOT constant: it depends on RPM and pressure because of helical pump
 * slip. Every reported/exported K is recorded together with its operating
 * point (Hz, pumpRpm, pressure, density).
 */

export const PULSES_PER_HZ = 2.4;
export const MOTOR_RPM_PER_PULSE_HZ = 12.5;
/** 2.4 pulses/Hz x 12.5 RPM/pulseHz => 4.8 pulses per motor revolution. */
export const PULSES_PER_MOTOR_REV = 4.8;

/**
 * GA800 profile. A versioned, read-only entity isolated from the user form.
 * gearRatio does NOT live here — it belongs to the pump assembly.
 */
export interface GA800Profile {
  id: string;
  version: string;
  /** H6-06: pulse monitor selection (documented). */
  h6_06: string;
  /** H6-07: pulse monitor scaling (documented). */
  h6_07: number;
  /** C1-01: acceleration time (s) to reach max frequency. */
  accelTimeS: number;
  /** C1-02: deceleration time (s) from max frequency. */
  decelTimeS: number;
  /** b1-03: stopping method. */
  stoppingMethod: 'ramp' | 'coast';
  /** Max frequency used as the reference for ramp times (Hz). */
  maxFrequencyHz: number;
}

export const pulseHzFromOutputHz = (outputHz: number): number =>
  outputHz * PULSES_PER_HZ;

export const motorRpmFromPulseHz = (pulseHz: number): number =>
  pulseHz * MOTOR_RPM_PER_PULSE_HZ;

export const pumpRpmFromMotorRpm = (motorRpm: number, gearRatio: number): number =>
  motorRpm / gearRatio;

export const pulsesPerRevPump = (gearRatio: number): number =>
  4.8 * gearRatio;

/** Operating point captured alongside every K value. */
export interface OperatingPoint {
  outputHz: number;
  pulseHz: number;
  motorRpm: number;
  pumpRpm: number;
  flowM3h: number;
  pressureBar: number;
  densityKgM3: number;
}

/** Convenience: full chain from output Hz to pump RPM. */
export const computeDrive = (
  outputHz: number,
  gearRatio: number,
): { pulseHz: number; motorRpm: number; pumpRpm: number } => {
  const pulseHz = pulseHzFromOutputHz(outputHz);
  const motorRpm = motorRpmFromPulseHz(pulseHz);
  const pumpRpm = pumpRpmFromMotorRpm(motorRpm, gearRatio);
  return { pulseHz, motorRpm, pumpRpm };
};

/**
 * K in pulses per kg at an operating point.
 * K = pulseHz * 3600 / (Q[m^3/h] * rho[kg/m^3])
 * Returns Infinity guard as NaN-safe: throws if flow or density is non-positive.
 */
export const pulsesPerKg = (
  pulseHz: number,
  flowM3h: number,
  densityKgM3: number,
): number => {
  if (flowM3h <= 0 || densityKgM3 <= 0) {
    throw new Error('pulsesPerKg requires positive flow and density');
  }
  return (pulseHz * 3600) / (flowM3h * densityKgM3);
};
