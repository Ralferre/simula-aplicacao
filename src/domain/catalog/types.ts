/**
 * Catalog type definitions for the RSOFT dosing simulator (Rev01).
 *
 * Design decisions (confirmed with stakeholder):
 *  - Pressure is a DISCRETE selector per pump. Each pump publishes a fixed list
 *    of pressure options that exist in the Netzsch curves. The engine never
 *    interpolates/extrapolates between pressures.
 *  - Range labels such as "0-2 bar" are a SINGLE option in the dropdown.
 *  - Hybrid curve representation: each curve stores the digitized points, the
 *    fitted function coefficients (Q = a*n - b, power analogous) and fit
 *    metrics (R^2, RMSE). The engine simulates with the fitted function; the
 *    points are the auditable source of truth.
 *  - The whole catalog is a versioned, read-only artifact with a content hash.
 */

/** A single digitized point: pump RPM vs. value (flow in m^3/h or power in kW). */
export interface CurvePoint {
  /** Pump RPM. */
  rpm: number;
  /** Value at that RPM: flow in m^3/h for flow curves, kW for power curves. */
  value: number;
}

/**
 * Fitted linear model: value = a * rpm + b.
 *
 * For flow of a positive-displacement helical pump this is Q = a*n - b, where
 * the negative intercept captures slip at a fixed pressure. Stored generically
 * as (a, b) with value = a*rpm + b so b is simply negative for flow.
 */
export interface LinearFit {
  /** Slope (value per RPM). */
  a: number;
  /** Intercept (value at RPM = 0). */
  b: number;
  /** Coefficient of determination (quality of fit, 0..1). */
  r2: number;
  /** Root-mean-square error in the value unit. */
  rmse: number;
}

/** A fitted curve for one physical quantity at a fixed pressure. */
export interface FittedCurve {
  points: CurvePoint[];
  fit: LinearFit;
}

/**
 * One pressure option for a pump. `id` is a stable key used by the UI dropdown
 * and persisted in records. `label` is the human text (e.g. "0-2 bar").
 *
 * `bar` is the representative pressure used by snapping and the hydraulic model.
 * For a range label like "0-2 bar", `bar` is the representative value of that
 * curve (e.g. the pressure at which the curve was published, or the midpoint).
 */
export interface PressureOption {
  id: string;
  label: string;
  /** Representative pressure in bar used for snapping and hydraulics. */
  bar: number;
  /** Lower bound in bar (equals `bar` for a single-value option). */
  minBar: number;
  /** Upper bound in bar (equals `bar` for a single-value option). */
  maxBar: number;
  flow: FittedCurve;
  power: FittedCurve;
}

/** Operational limits for a pump, shared across all pressure options. */
export interface PumpLimits {
  rpmMin: number;
  rpmMax: number;
  pressureMaxBar: number;
}

/** Provenance metadata for traceability back to the source document. */
export interface SourceMeta {
  document: string;
  page?: number;
  catalogRevision?: string;
  referenceFluid: string;
}

/** Construction series of the pump (affects which motor/gearbox table applies). */
export type PumpSeries = 'BY' | 'BO' | 'BH' | 'SY' | 'SP';

/**
 * A motor + gearbox option for a pump, transcribed from the Netzsch tables
 * (pages 10/14/22 for the monobloc series BY/BO/BH).
 *
 * `gearboxModel` is the Netzsch gear-motor code (e.g. "NS 17"). For bearing
 * series (SY/SP) driven by belts/pulleys there is no NS gearbox, so the model
 * is "externo". The numeric reduction ratio (gearRatio) is NOT published by
 * Netzsch per NS code, so it is entered by the user at runtime — never guessed.
 */
export interface MotorOption {
  /** Rated motor power in kW. */
  motorKw: number;
  /** Gearbox model code (e.g. "NS 17") or "externo" for bearing series. */
  gearboxModel: string;
}

/** A pump entry in the catalog. */
export interface PumpCurve {
  /** Full curve code, e.g. "NM031--01L". */
  code: string;
  /** Display name. */
  name: string;
  /** Construction series (BY/BO/BH monobloc, SY/SP bearing). */
  series: PumpSeries;
  /**
   * Motor + gearbox options from the Netzsch tables. The reduction ratio
   * (gearRatio) is supplied by the user at runtime, not stored here.
   */
  motorOptions: MotorOption[];
  limits: PumpLimits;
  source: SourceMeta;
  /** Discrete pressure options available for this pump. */
  pressures: PressureOption[];
}

/** The versioned catalog artifact. */
export interface Catalog {
  /** Semantic version of the catalog content. */
  version: string;
  /** ISO date the catalog was generated. */
  generatedAt: string;
  /** Content hash (sha256) of the pumps payload, used by catalog:verify. */
  hash: string;
  pumps: PumpCurve[];
}
