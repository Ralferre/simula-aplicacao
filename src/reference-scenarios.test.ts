/**
 * Reference scenarios: deterministic end-to-end runs at 30 Hz and 60 Hz with a
 * fixed seed, against the real catalog (NM031--01L). kNominal is derived from
 * the published curve at the command speed (as the UI does), so the scenarios
 * track the real data. These assert determinism and physical sanity; if the
 * engine or catalog changes results, review intentionally.
 */
import { describe, expect, it } from 'vitest';
import { getPump } from './data/catalog';
import { getPressureOption } from './domain/catalog/pressure';
import { lookupFlow } from './domain/catalog/lookup';
import { computeDrive, pulsesPerKg } from './domain/ga800/model';
import { DEFAULT_GA800_PROFILE } from './domain/ga800/profiles';
import { type Mode2Config, runMode2 } from './domain/simulation/mode2';

const pump = getPump('NM031--01L');
const profile = { ...DEFAULT_GA800_PROFILE, accelTimeS: 0.3, decelTimeS: 0.3 };
const GEAR = 4;
const DENSITY = 1000;

/** Nominal K at the command speed, as the UI computes it. */
const kNominalAt = (commandHz: number, pressureId: string): number => {
  const pressure = getPressureOption(pump, pressureId);
  const { pumpRpm, pulseHz } = computeDrive(commandHz, GEAR);
  const flow = lookupFlow(pump, pressure, pumpRpm);
  return pulsesPerKg(pulseHz, flow, DENSITY);
};

const configAt = (commandHz: number): Mode2Config => ({
  pumpCode: 'NM031--01L',
  pressureId: 'p4',
  commandHz,
  targetMassKg: 2,
  densityKgM3: DENSITY,
  motorRatedPowerKw: 5,
  gearRatio: GEAR,
  motorKw: 1.5,
  gearboxModel: 'NS 27',
  kNominal: kNominalAt(commandHz, 'p4'),
  preact: 20,
  timeoutS: 600,
  seed: 2026,
  pressureJitterFrac: 0.02,
  densityJitterFrac: 0.005,
});

describe('reference scenarios (seed 2026, dt 0.01)', () => {
  it('60 Hz run is deterministic and reaches DONE near the target', () => {
    const a = runMode2(configAt(60), pump, profile, 0.01);
    const b = runMode2(configAt(60), pump, profile, 0.01);
    expect(a.phase).toBe('DONE');
    expect(a.plantState.engine.massKg).toBe(b.plantState.engine.massKg);
    expect(a.plantState.engine.pulseCount).toBe(b.plantState.engine.pulseCount);
    // dosed close to the 2 kg target (within ~10%)
    expect(a.plantState.engine.massKg).toBeGreaterThan(1.8);
    expect(a.plantState.engine.massKg).toBeLessThan(2.2);
  });

  it('30 Hz run is deterministic and reaches DONE near the target', () => {
    const a = runMode2(configAt(30), pump, profile, 0.01);
    const b = runMode2(configAt(30), pump, profile, 0.01);
    expect(a.phase).toBe('DONE');
    expect(a.plantState.engine.massKg).toBe(b.plantState.engine.massKg);
    expect(a.plantState.engine.massKg).toBeGreaterThan(1.8);
    expect(a.plantState.engine.massKg).toBeLessThan(2.2);
  });

  it('60 Hz delivers faster than 30 Hz (fewer sim seconds to target)', () => {
    const fast = runMode2(configAt(60), pump, profile, 0.01);
    const slow = runMode2(configAt(30), pump, profile, 0.01);
    expect(fast.plantState.engine.timeS).toBeLessThan(slow.plantState.engine.timeS);
  });
});
