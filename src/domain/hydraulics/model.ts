/**
 * Hydraulic line model (Mode 1): extended Bernoulli with Darcy-Weisbach.
 *
 * All internal math is in SI (Q in m^3/s, P in Pa, mu in Pa.s, lengths in m).
 * Conversions to bar / m^3/h / mm / mPa.s happen only at the edges.
 *
 *   v        = Q / A ;  Re = rho v D / mu
 *   f        = 64 / Re (laminar) | Swamee-Jain (turbulent)
 *   dP_line  = (f L / D + sumK) * rho v^2 / 2
 *   P_disch  = P_dest + rho g dz + dP_line
 *
 * The published curve remains the source of truth for flow. The hydraulics
 * only determine the operating pressure, flow regime and efficiency. The
 * computed discharge pressure is then SNAPPED to the nearest published pressure
 * option so the engine always queries a curve that exists (Rev01 rule 1=a).
 */

import { snapToPublishedPressure } from '../catalog/pressure';
import type { PressureOption, PumpCurve } from '../catalog/types';
import { GRAVITY, barToPa, mmToM, mPasToPas, m3hToM3s, paToBar } from '../units';

export type FlowRegime = 'laminar' | 'transition' | 'turbulent';

export interface HydraulicInput {
  /** Flow in m^3/h (from the curve at the operating point). */
  flowM3h: number;
  /** Internal diameter in mm. */
  diameterMm: number;
  /** Pipe length in m. */
  lengthM: number;
  /** Elevation change in m (positive = destination higher). */
  elevationM: number;
  /** Sum of local loss coefficients (dimensionless). */
  sumK: number;
  /** Dynamic viscosity in mPa.s. */
  viscosityMPas: number;
  /** Destination pressure in bar. */
  destinationBar: number;
  /** Product density in kg/m^3. */
  densityKgM3: number;
  /** Absolute pipe roughness in mm (default 0.045 mm, commercial steel). */
  roughnessMm?: number;
}

export interface HydraulicResult {
  reynolds: number;
  regime: FlowRegime;
  frictionFactor: number;
  velocityMs: number;
  /** Line pressure loss in bar. */
  lineLossBar: number;
  /** Computed discharge pressure in bar (continuous). */
  dischargeBar: number;
  /** Hydraulic power in W (Q * dP). */
  hydraulicPowerW: number;
  alerts: string[];
}

/** Reynolds-based friction factor (laminar 64/Re, Swamee-Jain turbulent). */
export const frictionFactor = (
  reynolds: number,
  relativeRoughness: number,
): number => {
  if (reynolds <= 0) return 0;
  if (reynolds < 2300) {
    return 64 / reynolds;
  }
  // Swamee-Jain explicit approximation of Colebrook (valid for turbulent).
  const term = relativeRoughness / 3.7 + 5.74 / Math.pow(reynolds, 0.9);
  return 0.25 / Math.pow(Math.log10(term), 2);
};

export const classifyRegime = (reynolds: number): FlowRegime => {
  if (reynolds < 2300) return 'laminar';
  if (reynolds <= 4000) return 'transition';
  return 'turbulent';
};

/**
 * Compute the hydraulic state for Mode 1. Pure, SI internally.
 */
export const computeHydraulics = (input: HydraulicInput): HydraulicResult => {
  const alerts: string[] = [];

  const Q = m3hToM3s(input.flowM3h); // m^3/s
  const D = mmToM(input.diameterMm); // m
  const mu = mPasToPas(input.viscosityMPas); // Pa.s
  const rho = input.densityKgM3;
  const roughness = mmToM(input.roughnessMm ?? 0.045); // m
  const area = (Math.PI * D * D) / 4;
  const v = area > 0 ? Q / area : 0;

  const reynolds = mu > 0 ? (rho * v * D) / mu : 0;
  const regime = classifyRegime(reynolds);
  const relRoughness = D > 0 ? roughness / D : 0;
  const f = frictionFactor(reynolds, relRoughness);

  // dP_line = (f L / D + sumK) * rho v^2 / 2   [Pa]
  const dPLinePa = (f * (input.lengthM / D) + input.sumK) * ((rho * v * v) / 2);
  // P_disch = P_dest + rho g dz + dP_line   [Pa]
  const dischargePa =
    barToPa(input.destinationBar) + rho * GRAVITY * input.elevationM + dPLinePa;

  const dPTotalPa = dischargePa - barToPa(input.destinationBar);
  const hydraulicPowerW = Q * dPTotalPa;

  if (regime === 'transition') {
    alerts.push(
      'Regime de transição (2300 < Re < 4000): fator de atrito incerto.',
    );
  }
  // Netzsch curves are referenced to water (~1 mPa.s).
  if (input.viscosityMPas > 2) {
    alerts.push(
      'Viscosidade acima da base da curva Netzsch (água). Resultado indicativo.',
    );
  }

  return {
    reynolds,
    regime,
    frictionFactor: f,
    velocityMs: v,
    lineLossBar: paToBar(dPLinePa),
    dischargeBar: paToBar(dischargePa),
    hydraulicPowerW,
    alerts,
  };
};

/**
 * Compute hydraulics and snap the resulting discharge pressure to the nearest
 * published pressure option (Rev01 rule 1=a).
 */
export const computeHydraulicsAndSnap = (
  input: HydraulicInput,
  pump: PumpCurve,
): { hydraulics: HydraulicResult; pressure: PressureOption } => {
  const hydraulics = computeHydraulics(input);
  const pressure = snapToPublishedPressure(hydraulics.dischargeBar, pump);
  return { hydraulics, pressure };
};
