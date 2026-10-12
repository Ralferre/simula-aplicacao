import { describe, expect, it } from 'vitest';
import { NM031 } from '../__fixtures__/pumps';
import { DEFAULT_GA800_PROFILE } from '../ga800/profiles';
import {
  type Mode1Config,
  adjustMode1,
  confirmMode1,
  initialMode1State,
  pauseMode1,
  resetMode1,
  resumeMode1,
  startMode1,
  tickMode1,
} from './mode1';

const CONFIG: Mode1Config = {
  pumpCode: 'NM031--01L',
  pressureId: 'p4',
  commandHz: 60,
  targetMassKg: 50,
  densityKgM3: 1000,
  motorRatedPowerKw: 5,
  gearRatio: 4,
  motorKw: 1.5,
  gearboxModel: 'NS 27',
  totalTimeS: 5,
};

const profile = { ...DEFAULT_GA800_PROFILE, accelTimeS: 0, decelTimeS: 0 };

describe('Mode 1 state machine', () => {
  it('confirm moves draft to ready with an immutable config', () => {
    const s = confirmMode1(initialMode1State(), CONFIG);
    expect(s.phase).toBe('ready');
    expect(s.config).toEqual(CONFIG);
  });

  it('start only works from ready or done', () => {
    const draft = initialMode1State();
    expect(startMode1(draft).phase).toBe('draft'); // no config -> no start
    const ready = confirmMode1(draft, CONFIG);
    expect(startMode1(ready).phase).toBe('running');
  });

  it('pause freezes the accumulators (no advance while paused)', () => {
    let s = startMode1(confirmMode1(initialMode1State(), CONFIG));
    s = tickMode1(s, NM031, profile, 1);
    const vol = s.engine.volumeL;
    s = pauseMode1(s);
    s = tickMode1(s, NM031, profile, 1); // ignored while paused
    expect(s.engine.volumeL).toBe(vol);
    s = resumeMode1(s);
    s = tickMode1(s, NM031, profile, 1);
    expect(s.engine.volumeL).toBeGreaterThan(vol);
  });

  it('ends the cycle at the configured total time and captures errors', () => {
    let s = startMode1(confirmMode1(initialMode1State(), CONFIG));
    for (let i = 0; i < 5 && s.phase === 'running'; i++) {
      s = tickMode1(s, NM031, profile, 1);
    }
    expect(s.phase).toBe('done');
    expect(s.engine.timeS).toBeGreaterThanOrEqual(CONFIG.totalTimeS);
    expect(s.errors).not.toBeNull();
    // at 60 Hz, 450 RPM, p4 flow = 0.02*450 - 2 = 7 m^3/h
    expect(s.engine.flowM3h).toBeCloseTo(7, 6);
  });

  it('flags power insufficiency when required exceeds the motor rating', () => {
    let s = startMode1(
      confirmMode1(initialMode1State(), { ...CONFIG, motorRatedPowerKw: 0.1 }),
    );
    s = tickMode1(s, NM031, profile, 1);
    expect(s.powerInsufficient).toBe(true);
    expect(s.alerts.some((a) => a.includes('Potência'))).toBe(true);
  });

  it('reset returns to ready without auto-start', () => {
    let s = startMode1(confirmMode1(initialMode1State(), CONFIG));
    s = tickMode1(s, NM031, profile, 1);
    s = resetMode1(s);
    expect(s.phase).toBe('ready');
    expect(s.engine.timeS).toBe(0);
  });

  it('adjust returns to draft for editing', () => {
    const s = adjustMode1(confirmMode1(initialMode1State(), CONFIG));
    expect(s.phase).toBe('draft');
  });

  it('computes K pulses/kg at the operating point', () => {
    let s = startMode1(confirmMode1(initialMode1State(), CONFIG));
    s = tickMode1(s, NM031, profile, 1);
    // pulseHz=144, Q=7, rho=1000 -> K = 144*3600/(7*1000) = 74.057
    expect(s.kPulsesPerKg).toBeCloseTo(74.057, 2);
  });
});
