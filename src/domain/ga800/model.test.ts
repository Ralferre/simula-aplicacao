import { describe, expect, it } from 'vitest';
import {
  computeDrive,
  motorRpmFromPulseHz,
  pulseHzFromOutputHz,
  pulsesPerKg,
  pulsesPerRevPump,
  pumpRpmFromMotorRpm,
} from './model';

describe('GA800 + gear conversions', () => {
  it('60 Hz output -> 144 pulse Hz -> 1800 motor RPM', () => {
    const pulseHz = pulseHzFromOutputHz(60);
    expect(pulseHz).toBeCloseTo(144, 10);
    expect(motorRpmFromPulseHz(pulseHz)).toBeCloseTo(1800, 10);
  });

  it('30 Hz output -> 72 pulse Hz -> 900 motor RPM', () => {
    const pulseHz = pulseHzFromOutputHz(30);
    expect(pulseHz).toBeCloseTo(72, 10);
    expect(motorRpmFromPulseHz(pulseHz)).toBeCloseTo(900, 10);
  });

  it('gearRatio=4 -> 60 Hz gives 450 pump RPM', () => {
    const { pumpRpm } = computeDrive(60, 4);
    expect(pumpRpm).toBeCloseTo(450, 10);
  });

  it('gearRatio=4 -> 19.2 pulses per pump revolution', () => {
    expect(pulsesPerRevPump(4)).toBeCloseTo(19.2, 10);
  });

  it('gearRatio=1 -> 60 Hz gives 1800 pump RPM', () => {
    expect(pumpRpmFromMotorRpm(1800, 1)).toBe(1800);
  });

  it('K pulses/kg is coherent with the operating point', () => {
    // pulseHz=144, Q=5 m^3/h, rho=1000 kg/m^3
    // K = 144*3600 / (5*1000) = 518400 / 5000 = 103.68 pulses/kg
    expect(pulsesPerKg(144, 5, 1000)).toBeCloseTo(103.68, 6);
  });

  it('K throws for non-positive flow or density', () => {
    expect(() => pulsesPerKg(144, 0, 1000)).toThrow();
    expect(() => pulsesPerKg(144, 5, 0)).toThrow();
  });
});
