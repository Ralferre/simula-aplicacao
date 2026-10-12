/**
 * Output-frequency ramp model (GA800 C1-01 accel / C1-02 decel).
 *
 * Baseline model: LINEAR ramp. The acceleration/deceleration times are defined
 * (per GA800 convention) as the time to go from 0 to maxFrequencyHz (accel) and
 * from maxFrequencyHz to 0 (decel). The slope is therefore maxFrequencyHz /
 * time. S-curve shaping is out of scope for this MVP and documented as such.
 */

export interface RampParams {
  /** C1-01 acceleration time (s) across the full max-frequency span. */
  accelTimeS: number;
  /** C1-02 deceleration time (s) across the full max-frequency span. */
  decelTimeS: number;
  /** Reference max frequency for the ramp slopes (Hz). */
  maxFrequencyHz: number;
}

/**
 * Advance the output frequency one fixed step toward the command.
 *
 * @param currentHz current output Hz
 * @param commandHz commanded Hz (target)
 * @param dtS fixed step in seconds
 * @param params ramp parameters
 * @returns the next output Hz, never overshooting the command
 */
export const ramp = (
  currentHz: number,
  commandHz: number,
  dtS: number,
  params: RampParams,
): number => {
  const { accelTimeS, decelTimeS, maxFrequencyHz } = params;

  if (commandHz > currentHz) {
    // Accelerating.
    const slope = accelTimeS > 0 ? maxFrequencyHz / accelTimeS : Infinity;
    const next = currentHz + slope * dtS;
    return Math.min(next, commandHz);
  }
  if (commandHz < currentHz) {
    // Decelerating.
    const slope = decelTimeS > 0 ? maxFrequencyHz / decelTimeS : Infinity;
    const next = currentHz - slope * dtS;
    return Math.max(next, commandHz);
  }
  return currentHz;
};
