/**
 * Per-series statistics and deterministic suggestions.
 *
 * Computed over the records of a single series. All functions are pure.
 */

import type { SimulationRecord } from '../simulation/record';

export interface SeriesStats {
  count: number;
  /** Mean delivered mass (kg). */
  meanMassKg: number;
  /** Sample standard deviation of delivered mass (kg). */
  stdMassKg: number;
  minMassKg: number;
  maxMassKg: number;
  /** Mean absolute percentage error of mass vs. target. */
  mapePercent: number;
  /** Repeatability = std of delivered mass (kg) (lower is better). */
  repeatabilityKg: number;
  /** Linear trend of mass error (kg) per cycle index (slope). */
  errorTrendKgPerCycle: number;
  /** Process capability indices against a tolerance (if provided). */
  cp: number | null;
  cpk: number | null;
}

export interface Suggestions {
  /** Suggested pre-act in pulses = mean overshoot in pulses. */
  suggestedPreactPulses: number | null;
  /** Corrected K = K * (target / mean delivered). */
  correctedK: number | null;
}

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

const std = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
};

/** Ordinary least squares slope of y over the index 0..n-1. */
const slopeByIndex = (ys: number[]): number => {
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
};

export interface StatsOptions {
  /** Tolerance half-width in kg for Cp/Cpk (USL/LSL = target +/- tol). */
  toleranceKg?: number;
}

export const computeSeriesStats = (
  records: SimulationRecord[],
  options: StatsOptions = {},
): SeriesStats => {
  const masses = records.map((r) => r.massKg);
  const errorsPct = records.map((r) => Math.abs(r.massErrorPercent));
  const errorKg = records.map((r) => r.massErrorKg);

  const meanMassKg = mean(masses);
  const stdMassKg = std(masses);
  const mapePercent = mean(errorsPct);

  let cp: number | null = null;
  let cpk: number | null = null;
  const tol = options.toleranceKg;
  if (tol && tol > 0 && records.length >= 2 && stdMassKg > 0) {
    const target = records[0].targetMassKg;
    const usl = target + tol;
    const lsl = target - tol;
    cp = (usl - lsl) / (6 * stdMassKg);
    cpk = Math.min(
      (usl - meanMassKg) / (3 * stdMassKg),
      (meanMassKg - lsl) / (3 * stdMassKg),
    );
  }

  return {
    count: records.length,
    meanMassKg,
    stdMassKg,
    minMassKg: masses.length ? Math.min(...masses) : 0,
    maxMassKg: masses.length ? Math.max(...masses) : 0,
    mapePercent,
    repeatabilityKg: stdMassKg,
    errorTrendKgPerCycle: slopeByIndex(errorKg),
    cp,
    cpk,
  };
};

/**
 * Deterministic suggestions:
 *  - suggested preact (pulses) = mean overshoot in pulses. Overshoot is the
 *    pulses accumulated beyond the preset. For records with preset+preact we
 *    estimate overshoot as pulseCount - (preset - preact).
 *  - corrected K = K * (target / mean delivered).
 */
export const computeSuggestions = (
  records: SimulationRecord[],
): Suggestions => {
  if (records.length === 0) {
    return { suggestedPreactPulses: null, correctedK: null };
  }

  const overshoots = records
    .filter((r) => r.preset != null && r.preact != null)
    .map((r) => r.pulseCount - ((r.preset as number) - (r.preact as number)));
  const suggestedPreactPulses =
    overshoots.length > 0 ? Math.round(mean(overshoots)) : null;

  const meanMass = mean(records.map((r) => r.massKg));
  const target = records[0].targetMassKg;
  const kValues = records.map((r) => r.kPulsesPerKg).filter((k): k is number => k != null);
  const meanK = kValues.length ? mean(kValues) : null;
  const correctedK =
    meanK != null && meanMass > 0 ? meanK * (target / meanMass) : null;

  return { suggestedPreactPulses, correctedK };
};
