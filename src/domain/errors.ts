/**
 * Domain-specific error types for the RSOFT dosing simulator.
 *
 * These errors represent explicit, recoverable domain conditions (e.g. a value
 * outside the published curve range). They are never used for programming bugs.
 */

export type DomainErrorCode =
  | 'OUT_OF_CURVE_RANGE'
  | 'PUMP_NOT_FOUND'
  | 'PRESSURE_NOT_FOUND'
  | 'POWER_INSUFFICIENT'
  | 'INVALID_CONFIG';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    // Restore prototype chain for instanceof checks after transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a lookup is requested for a pump RPM (or pressure) outside the
 * published range of the Netzsch curve. The engine never clamps or extrapolates
 * silently; it blocks with this explicit error.
 */
export class OutOfCurveRange extends DomainError {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly quantity: string;

  constructor(quantity: string, value: number, min: number, max: number) {
    super(
      'OUT_OF_CURVE_RANGE',
      `${quantity}=${value} is outside the published range [${min}, ${max}]`,
    );
    this.name = 'OutOfCurveRange';
    this.quantity = quantity;
    this.value = value;
    this.min = min;
    this.max = max;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PumpNotFound extends DomainError {
  constructor(code: string) {
    super('PUMP_NOT_FOUND', `Pump not found in catalog: ${code}`);
    this.name = 'PumpNotFound';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PressureNotFound extends DomainError {
  constructor(pumpCode: string, pressureId: string) {
    super(
      'PRESSURE_NOT_FOUND',
      `Pressure option "${pressureId}" not found for pump ${pumpCode}`,
    );
    this.name = 'PressureNotFound';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
