/**
 * Pure PLC scan logic, mirroring IEC 61131-3 Structured Text so it can be
 * ported to a real controller later.
 *
 *   plcScan(inputs, memory) -> { outputs, memory }
 *
 * I/O map:
 *   I0.0 Start   (rising edge triggers the cycle via R_TRIG)
 *   I0.1 Stop    (normally-closed: true = OK, false = stop asserted)
 *   I0.2 E-stop  (normally-closed: true = OK, false = emergency asserted)
 *   Q0.0 Run     (RUN command to the GA800)
 *
 * Preset is computed from nominal K: preset = round(targetMassKg * K_nominal).
 * Cut-off occurs at HSC >= preset - preact.
 */

export type PlcState = 'IDLE' | 'RUNNING' | 'STOPPING' | 'DONE' | 'FAULT';

export interface PlcInputs {
  /** I0.0 Start pushbutton (true while pressed). */
  start: boolean;
  /** I0.1 Stop, normally-closed (true = OK). */
  stopNc: boolean;
  /** I0.2 E-stop, normally-closed (true = OK). */
  estopNc: boolean;
  /** Current integer high-speed counter value. */
  hsc: number;
  /** True when the pump has fully stopped (pumpRpm == 0). */
  pumpStopped: boolean;
  /** True when a power overload is detected by the plant. */
  overload: boolean;
  /** Elapsed time since RUN asserted, seconds (for the watchdog). */
  elapsedS: number;
}

export interface PlcConfig {
  preset: number;
  preact: number;
  /** Watchdog timeout in seconds. */
  timeoutS: number;
}

export interface PlcMemory {
  state: PlcState;
  /** Previous Start level, for rising-edge detection (R_TRIG). */
  prevStart: boolean;
  faultReason: string | null;
}

export interface PlcOutputs {
  /** Q0.0 RUN command. */
  run: boolean;
}

export const initialPlcMemory = (): PlcMemory => ({
  state: 'IDLE',
  prevStart: false,
  faultReason: null,
});

/** Compute the counter preset from nominal K. */
export const computePreset = (targetMassKg: number, kNominal: number): number =>
  Math.round(targetMassKg * kNominal);

export interface PlcScanResult {
  outputs: PlcOutputs;
  memory: PlcMemory;
}

/**
 * One PLC scan. Pure: given the same inputs/memory/config it always returns the
 * same result.
 */
export const plcScan = (
  inputs: PlcInputs,
  memory: PlcMemory,
  config: PlcConfig,
): PlcScanResult => {
  const risingStart = inputs.start && !memory.prevStart;
  const prevStart = inputs.start;

  // Interlocks have priority over everything (NC logic: false = asserted).
  const estop = !inputs.estopNc;
  const stop = !inputs.stopNc;

  let state = memory.state;
  let faultReason = memory.faultReason;

  const toFault = (reason: string): PlcScanResult => ({
    outputs: { run: false },
    memory: { state: 'FAULT', prevStart, faultReason: reason },
  });

  // Emergency / stop / overload trip from any active state.
  if (state === 'RUNNING' || state === 'STOPPING') {
    if (estop) return toFault('E-stop');
    if (stop) return toFault('Stop');
    if (inputs.overload) return toFault('Overload');
    if (inputs.elapsedS > config.timeoutS) return toFault('Timeout');
  }

  switch (state) {
    case 'IDLE': {
      if (risingStart && !estop && !stop) {
        state = 'RUNNING';
        faultReason = null;
        return { outputs: { run: true }, memory: { state, prevStart, faultReason } };
      }
      return { outputs: { run: false }, memory: { state, prevStart, faultReason } };
    }
    case 'RUNNING': {
      // Cut off when the counter reaches preset minus pre-act.
      if (inputs.hsc >= config.preset - config.preact) {
        state = 'STOPPING';
        return { outputs: { run: false }, memory: { state, prevStart, faultReason } };
      }
      return { outputs: { run: true }, memory: { state, prevStart, faultReason } };
    }
    case 'STOPPING': {
      // RUN already de-asserted; wait for the pump to coast/ramp to zero.
      if (inputs.pumpStopped) {
        state = 'DONE';
      }
      return { outputs: { run: false }, memory: { state, prevStart, faultReason } };
    }
    case 'DONE':
    case 'FAULT': {
      // Latch until an external reset creates a fresh memory.
      return { outputs: { run: false }, memory: { state, prevStart, faultReason } };
    }
    default:
      return { outputs: { run: false }, memory: { state, prevStart, faultReason } };
  }
};
