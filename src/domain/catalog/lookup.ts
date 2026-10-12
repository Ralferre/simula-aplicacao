/**
 * 1D curve lookup (RPM) within the selected discrete pressure option.
 *
 * The engine evaluates the fitted function of the chosen pressure curve. Pump
 * RPM outside the published [rpmMin, rpmMax] range is blocked with
 * OutOfCurveRange — no clamping, no silent extrapolation.
 */

import { OutOfCurveRange } from '../errors';
import { evaluateFit } from './fit';
import type { PressureOption, PumpCurve } from './types';

const assertRpmInRange = (pump: PumpCurve, pumpRpm: number): void => {
  const { rpmMin, rpmMax } = pump.limits;
  if (pumpRpm < rpmMin || pumpRpm > rpmMax) {
    throw new OutOfCurveRange('pumpRpm', pumpRpm, rpmMin, rpmMax);
  }
};

/** Flow in m^3/h at a given pump RPM for the selected pressure. Blocks out of range. */
export const lookupFlow = (
  pump: PumpCurve,
  pressure: PressureOption,
  pumpRpm: number,
): number => {
  assertRpmInRange(pump, pumpRpm);
  return evaluateFit(pressure.flow.fit, pumpRpm);
};

/** Required power in kW at a given pump RPM for the selected pressure. Blocks out of range. */
export const lookupPower = (
  pump: PumpCurve,
  pressure: PressureOption,
  pumpRpm: number,
): number => {
  assertRpmInRange(pump, pumpRpm);
  return evaluateFit(pressure.power.fit, pumpRpm);
};

/** True when the pump RPM is within the published range. */
export const isRpmInRange = (pump: PumpCurve, pumpRpm: number): boolean =>
  pumpRpm >= pump.limits.rpmMin && pumpRpm <= pump.limits.rpmMax;
