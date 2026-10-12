/**
 * Discrete pressure selection for a pump.
 *
 * The user picks a pressure only from the published options of the selected
 * pump. In Mode 1, the hydraulic model may compute a continuous discharge
 * pressure; `snapToPublishedPressure` maps that continuous value to the nearest
 * published option so the engine always queries a curve that exists.
 */

import { PressureNotFound } from '../errors';
import type { PressureOption, PumpCurve } from './types';

/** List the pressure options available for a pump (dropdown source). */
export const listPressureOptions = (pump: PumpCurve): PressureOption[] =>
  pump.pressures;

/** Find a pressure option by its stable id, or throw. */
export const getPressureOption = (
  pump: PumpCurve,
  pressureId: string,
): PressureOption => {
  const option = pump.pressures.find((p) => p.id === pressureId);
  if (!option) {
    throw new PressureNotFound(pump.code, pressureId);
  }
  return option;
};

/**
 * Map a continuous pressure (bar) to the nearest published pressure option.
 *
 * "Nearest" is measured against each option's representative `bar`. When the
 * value falls inside an option's [minBar, maxBar] span, that option wins
 * outright (handles range labels like "0-2 bar"). Ties resolve to the lower
 * pressure for determinism.
 */
export const snapToPublishedPressure = (
  pressureBar: number,
  pump: PumpCurve,
): PressureOption => {
  if (pump.pressures.length === 0) {
    throw new PressureNotFound(pump.code, '<none>');
  }

  // Exact span containment first (covers range options such as "0-2 bar").
  const containing = pump.pressures.filter(
    (p) => pressureBar >= p.minBar && pressureBar <= p.maxBar,
  );
  if (containing.length > 0) {
    // If multiple spans contain the value, pick the lowest representative bar.
    return containing.reduce((best, p) => (p.bar < best.bar ? p : best));
  }

  // Otherwise nearest by representative bar, ties to the lower pressure.
  return pump.pressures.reduce((best, p) => {
    const dBest = Math.abs(best.bar - pressureBar);
    const dP = Math.abs(p.bar - pressureBar);
    if (dP < dBest) return p;
    if (dP === dBest && p.bar < best.bar) return p;
    return best;
  });
};
