import { describe, expect, it } from 'vitest';
import { NM031 } from '../__fixtures__/pumps';
import {
  classifyRegime,
  computeHydraulics,
  computeHydraulicsAndSnap,
  frictionFactor,
  type HydraulicInput,
} from './model';

describe('friction factor', () => {
  it('uses 64/Re in the laminar region', () => {
    expect(frictionFactor(1000, 0)).toBeCloseTo(64 / 1000, 10);
  });

  it('Swamee-Jain matches the known value for Re=1e5, rel roughness=0.001', () => {
    // f = 0.25 / (log10(0.001/3.7 + 5.74/1e5^0.9))^2
    const term = 0.001 / 3.7 + 5.74 / Math.pow(1e5, 0.9);
    const expected = 0.25 / Math.pow(Math.log10(term), 2);
    expect(frictionFactor(1e5, 0.001)).toBeCloseTo(expected, 12);
  });
});

describe('regime classification', () => {
  it('classifies laminar / transition / turbulent', () => {
    expect(classifyRegime(1500)).toBe('laminar');
    expect(classifyRegime(3000)).toBe('transition');
    expect(classifyRegime(5000)).toBe('turbulent');
  });
});

describe('computeHydraulics', () => {
  const base: HydraulicInput = {
    flowM3h: 3,
    diameterMm: 25,
    lengthM: 10,
    elevationM: 2,
    sumK: 1.5,
    viscosityMPas: 1,
    destinationBar: 1,
    densityKgM3: 1000,
  };

  it('produces a turbulent regime for water in a 25 mm pipe at 3 m^3/h', () => {
    const r = computeHydraulics(base);
    // v = Q/A; Q=3/3600=8.33e-4 m^3/s; A=pi*0.025^2/4=4.909e-4; v~1.7 m/s
    expect(r.velocityMs).toBeGreaterThan(1.5);
    expect(r.regime).toBe('turbulent');
    expect(r.reynolds).toBeGreaterThan(4000);
  });

  it('discharge pressure includes static head and line loss above destination', () => {
    const r = computeHydraulics(base);
    // destination 1 bar + rho*g*dz (2 m ~0.196 bar) + line loss > destination
    expect(r.dischargeBar).toBeGreaterThan(1 + 0.19);
  });

  it('flags transition regime with an alert', () => {
    // tune viscosity to land Re in (2300,4000)
    const r = computeHydraulics({ ...base, viscosityMPas: 15 });
    expect(['transition', 'laminar']).toContain(r.regime);
    if (r.regime === 'transition') {
      expect(r.alerts.some((a) => a.includes('transição'))).toBe(true);
    }
  });

  it('alerts when viscosity is far from the water base', () => {
    const r = computeHydraulics({ ...base, viscosityMPas: 50 });
    expect(r.alerts.some((a) => a.includes('Viscosidade'))).toBe(true);
  });

  it('laminar for very viscous low flow', () => {
    const r = computeHydraulics({
      ...base,
      flowM3h: 0.2,
      viscosityMPas: 200,
    });
    expect(r.regime).toBe('laminar');
    expect(r.frictionFactor).toBeCloseTo(64 / r.reynolds, 8);
  });
});

describe('computeHydraulicsAndSnap', () => {
  it('snaps the computed discharge pressure to a published option', () => {
    // Make discharge land near 4 bar: destination 3.5 bar + small loss
    const { hydraulics, pressure } = computeHydraulicsAndSnap(
      {
        flowM3h: 2,
        diameterMm: 32,
        lengthM: 5,
        elevationM: 0,
        sumK: 1,
        viscosityMPas: 1,
        destinationBar: 3.7,
        densityKgM3: 1000,
      },
      NM031,
    );
    expect(hydraulics.dischargeBar).toBeGreaterThan(3.5);
    // nearest published option among 2/4/6 bar
    expect(['4 bar', '6 bar']).toContain(pressure.label);
  });
});
