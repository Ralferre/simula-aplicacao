import { describe, expect, it } from 'vitest';
import type { SimulationRecord } from '../simulation/record';
import { computeSeriesStats, computeSuggestions } from './stats';

const rec = (over: Partial<SimulationRecord>): SimulationRecord => ({
  id: Math.random().toString(36).slice(2),
  mode: 'mode2',
  timestamp: '2026-01-01T00:00:00.000Z',
  pumpCode: 'NM031--01L',
  pressureId: 'p4',
  pressureBar: 4,
  catalogVersion: '1',
  profileId: 'g',
  profileVersion: '1',
  commandHz: 60,
  outputHz: 60,
  pulseHz: 144,
  motorRpm: 1800,
  pumpRpm: 450,
  flowM3h: 7,
  gearRatio: 4,
  motorKw: 1.5,
  gearboxModel: 'NS 27',
  densityKgM3: 1000,
  targetMassKg: 10,
  massKg: 10,
  volumeL: 10,
  kPulsesPerKg: 100,
  pulseCount: 1000,
  massErrorKg: 0,
  massErrorPercent: 0,
  totalTimeS: 10,
  elapsedTimeS: 10,
  requiredPowerKw: 1,
  motorRatedPowerKw: 5,
  preset: 1000,
  preact: 50,
  faultReason: null,
  alerts: [],
  ...over,
});

describe('computeSeriesStats', () => {
  it('computes mean, std, min/max, MAPE for a known dataset', () => {
    const records = [
      rec({ massKg: 9.8, massErrorKg: 0.2, massErrorPercent: 2 }),
      rec({ massKg: 10.0, massErrorKg: 0, massErrorPercent: 0 }),
      rec({ massKg: 10.2, massErrorKg: -0.2, massErrorPercent: -2 }),
    ];
    const s = computeSeriesStats(records);
    expect(s.count).toBe(3);
    expect(s.meanMassKg).toBeCloseTo(10, 10);
    expect(s.minMassKg).toBeCloseTo(9.8, 10);
    expect(s.maxMassKg).toBeCloseTo(10.2, 10);
    // sample std of [9.8,10,10.2] = 0.2
    expect(s.stdMassKg).toBeCloseTo(0.2, 10);
    // MAPE = mean(|2|,|0|,|2|) = 1.333
    expect(s.mapePercent).toBeCloseTo(4 / 3, 6);
  });

  it('computes Cp/Cpk against a tolerance', () => {
    const records = [
      rec({ massKg: 9.8 }),
      rec({ massKg: 10.0 }),
      rec({ massKg: 10.2 }),
    ];
    const s = computeSeriesStats(records, { toleranceKg: 1 });
    // std = 0.2; Cp = (11-9)/(6*0.2) = 2/1.2 = 1.6667
    expect(s.cp).toBeCloseTo(1.6667, 3);
    // mean 10 centered -> Cpk == Cp
    expect(s.cpk).toBeCloseTo(1.6667, 3);
  });

  it('computes a positive error trend when error grows per cycle', () => {
    const records = [
      rec({ massErrorKg: 0 }),
      rec({ massErrorKg: 0.1 }),
      rec({ massErrorKg: 0.2 }),
      rec({ massErrorKg: 0.3 }),
    ];
    const s = computeSeriesStats(records);
    expect(s.errorTrendKgPerCycle).toBeCloseTo(0.1, 6);
  });

  it('returns null Cp/Cpk without a tolerance', () => {
    const s = computeSeriesStats([rec({}), rec({})]);
    expect(s.cp).toBeNull();
    expect(s.cpk).toBeNull();
  });
});

describe('computeSuggestions', () => {
  it('suggests preact as mean overshoot in pulses', () => {
    // overshoot = pulseCount - (preset - preact)
    const records = [
      rec({ pulseCount: 1000, preset: 1000, preact: 50 }), // 1000-950=50
      rec({ pulseCount: 1020, preset: 1000, preact: 50 }), // 70
    ];
    const sug = computeSuggestions(records);
    // mean(50,70)=60
    expect(sug.suggestedPreactPulses).toBe(60);
  });

  it('corrects K toward the target when under-delivering', () => {
    const records = [
      rec({ massKg: 9, targetMassKg: 10, kPulsesPerKg: 100 }),
      rec({ massKg: 9, targetMassKg: 10, kPulsesPerKg: 100 }),
    ];
    const sug = computeSuggestions(records);
    // K * (10/9) = 111.11
    expect(sug.correctedK).toBeCloseTo(111.111, 2);
  });

  it('returns nulls for an empty series', () => {
    const sug = computeSuggestions([]);
    expect(sug.suggestedPreactPulses).toBeNull();
    expect(sug.correctedK).toBeNull();
  });
});
