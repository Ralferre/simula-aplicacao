import { describe, expect, it } from 'vitest';
import {
  type PlcConfig,
  type PlcInputs,
  computePreset,
  initialPlcMemory,
  plcScan,
} from './controller';
import { createRng } from './rng';

const CONFIG: PlcConfig = { preset: 1000, preact: 50, timeoutS: 60 };

const baseInputs = (overrides: Partial<PlcInputs> = {}): PlcInputs => ({
  start: false,
  stopNc: true,
  estopNc: true,
  hsc: 0,
  pumpStopped: false,
  overload: false,
  elapsedS: 0,
  ...overrides,
});

describe('plcScan', () => {
  it('computes preset from nominal K', () => {
    expect(computePreset(10, 103.68)).toBe(1037);
  });

  it('requires a rising edge on Start to run', () => {
    let mem = initialPlcMemory();
    // Start already high: no rising edge after first scan sets prevStart.
    let r = plcScan(baseInputs({ start: true }), mem, CONFIG);
    expect(r.memory.state).toBe('RUNNING'); // first scan sees rising edge
    mem = initialPlcMemory();
    // Hold start high across scans: only the first transition triggers.
    r = plcScan(baseInputs({ start: false }), mem, CONFIG);
    expect(r.memory.state).toBe('IDLE');
    r = plcScan(baseInputs({ start: true }), r.memory, CONFIG);
    expect(r.memory.state).toBe('RUNNING');
  });

  it('asserts RUN while running and cuts off at preset - preact', () => {
    let r = plcScan(baseInputs({ start: true }), initialPlcMemory(), CONFIG);
    expect(r.outputs.run).toBe(true);
    // below cutoff
    r = plcScan(baseInputs({ start: true, hsc: 900 }), r.memory, CONFIG);
    expect(r.outputs.run).toBe(true);
    expect(r.memory.state).toBe('RUNNING');
    // reach cutoff: preset - preact = 950
    r = plcScan(baseInputs({ start: true, hsc: 950 }), r.memory, CONFIG);
    expect(r.outputs.run).toBe(false);
    expect(r.memory.state).toBe('STOPPING');
  });

  it('transitions STOPPING -> DONE when the pump stops', () => {
    let r = plcScan(baseInputs({ start: true }), initialPlcMemory(), CONFIG);
    r = plcScan(baseInputs({ start: true, hsc: 950 }), r.memory, CONFIG);
    expect(r.memory.state).toBe('STOPPING');
    r = plcScan(baseInputs({ start: true, hsc: 1000, pumpStopped: true }), r.memory, CONFIG);
    expect(r.memory.state).toBe('DONE');
  });

  it('faults on E-stop with priority over start', () => {
    let r = plcScan(baseInputs({ start: true }), initialPlcMemory(), CONFIG);
    r = plcScan(baseInputs({ start: true, estopNc: false }), r.memory, CONFIG);
    expect(r.memory.state).toBe('FAULT');
    expect(r.memory.faultReason).toBe('E-stop');
    expect(r.outputs.run).toBe(false);
  });

  it('faults on Stop while running', () => {
    let r = plcScan(baseInputs({ start: true }), initialPlcMemory(), CONFIG);
    r = plcScan(baseInputs({ start: true, stopNc: false }), r.memory, CONFIG);
    expect(r.memory.state).toBe('FAULT');
    expect(r.memory.faultReason).toBe('Stop');
  });

  it('faults on overload and on watchdog timeout', () => {
    let r = plcScan(baseInputs({ start: true }), initialPlcMemory(), CONFIG);
    const overload = plcScan(baseInputs({ start: true, overload: true }), r.memory, CONFIG);
    expect(overload.memory.faultReason).toBe('Overload');

    r = plcScan(baseInputs({ start: true }), initialPlcMemory(), CONFIG);
    const timeout = plcScan(baseInputs({ start: true, elapsedS: 61 }), r.memory, CONFIG);
    expect(timeout.memory.faultReason).toBe('Timeout');
  });
});

describe('seeded RNG', () => {
  it('is reproducible for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('differs across seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('normal is centered near the mean over many draws', () => {
    const r = createRng(7);
    let sum = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) sum += r.normal(10, 1);
    expect(sum / n).toBeCloseTo(10, 1);
  });
});
