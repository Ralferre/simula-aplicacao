import { describe, expect, it } from 'vitest';
import {
  barToPa,
  lToM3,
  m3ToL,
  m3hToM3s,
  m3sToM3h,
  massKgFromVolumeL,
  paToBar,
  volumeLFromMassKg,
} from './units';

describe('unit conversions', () => {
  it('bar <-> Pa round-trips', () => {
    expect(barToPa(1)).toBe(1e5);
    expect(paToBar(1e5)).toBe(1);
    expect(paToBar(barToPa(3.7))).toBeCloseTo(3.7, 10);
  });

  it('m3/h <-> m3/s round-trips', () => {
    expect(m3hToM3s(3600)).toBeCloseTo(1, 10);
    expect(m3sToM3h(1)).toBeCloseTo(3600, 10);
  });

  it('m3 <-> L', () => {
    expect(m3ToL(1)).toBe(1000);
    expect(lToM3(1000)).toBe(1);
  });

  it('mass from volume and density', () => {
    // 100 L of water (1000 kg/m^3) = 100 kg
    expect(massKgFromVolumeL(100, 1000)).toBeCloseTo(100, 10);
  });

  it('target volume from mass and density', () => {
    expect(volumeLFromMassKg(100, 1000)).toBeCloseTo(100, 10);
  });
});
