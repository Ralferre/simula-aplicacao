/**
 * Unit conversions for the RSOFT dosing simulator.
 *
 * Internal convention: the domain works in SI units.
 *  - Flow:      m^3/s
 *  - Pressure:  Pa
 *  - Viscosity: Pa.s
 *  - Length:    m
 *  - Density:   kg/m^3
 *  - Volume:    m^3 (exposed to the UI as liters)
 *
 * Conversions to engineering units (bar, m^3/h, L, mPa.s, mm) happen only at
 * the edges (UI, catalog, export). Keep SI inside the engine.
 */

export const BAR_TO_PA = 1e5;
export const PA_TO_BAR = 1 / BAR_TO_PA;

export const M3H_TO_M3S = 1 / 3600;
export const M3S_TO_M3H = 3600;

export const M3_TO_L = 1000;
export const L_TO_M3 = 1 / 1000;

export const MPAS_TO_PAS = 1e-3;
export const PAS_TO_MPAS = 1e3;

export const MM_TO_M = 1e-3;
export const M_TO_MM = 1e3;

/** Standard gravity used by the hydraulic model (m/s^2). */
export const GRAVITY = 9.80665;

export const barToPa = (bar: number): number => bar * BAR_TO_PA;
export const paToBar = (pa: number): number => pa * PA_TO_BAR;

export const m3hToM3s = (m3h: number): number => m3h * M3H_TO_M3S;
export const m3sToM3h = (m3s: number): number => m3s * M3S_TO_M3H;

export const m3ToL = (m3: number): number => m3 * M3_TO_L;
export const lToM3 = (l: number): number => l * L_TO_M3;

export const mPasToPas = (mPas: number): number => mPas * MPAS_TO_PAS;
export const pasToMPas = (pas: number): number => pas * PAS_TO_MPAS;

export const mmToM = (mm: number): number => mm * MM_TO_M;
export const mToMm = (m: number): number => m * M_TO_MM;

/**
 * Mass from volume and density.
 * massKg = volumeL * densityKgM3 / 1000
 */
export const massKgFromVolumeL = (volumeL: number, densityKgM3: number): number =>
  (volumeL * densityKgM3) / 1000;

/**
 * Target volume (in liters) from a target mass and density.
 * targetVolumeL = targetMassKg / densityKgM3 * 1000
 */
export const volumeLFromMassKg = (massKg: number, densityKgM3: number): number =>
  (massKg / densityKgM3) * 1000;
