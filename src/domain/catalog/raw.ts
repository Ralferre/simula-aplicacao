/**
 * Raw catalog source: digitized points per pump and pressure.
 *
 * IMPORTANT: these points are an INITIAL FIXTURE pending human validation
 * against the Netzsch NDB 106-06 PDF. They are deliberately marked as fixture.
 * The generate pipeline fits functions and computes the content hash from this
 * source. Replace the points with digitized+validated values before any
 * engineering use (see PLANO_MVP_Rev01.md).
 */

import type { MotorOption, PumpSeries } from './types';

export interface RawPressure {
  id: string;
  label: string;
  bar: number;
  minBar: number;
  maxBar: number;
  flowPoints: { rpm: number; value: number }[];
  powerPoints: { rpm: number; value: number }[];
}

export interface RawPump {
  code: string;
  name: string;
  series: PumpSeries;
  motorOptions: MotorOption[];
  limits: { rpmMin: number; rpmMax: number; pressureMaxBar: number };
  source: {
    document: string;
    page?: number;
    catalogRevision?: string;
    referenceFluid: string;
  };
  pressures: RawPressure[];
}

export interface RawCatalog {
  version: string;
  pumps: RawPump[];
}

/**
 * Build evenly spaced flow/power points from a slope/intercept so the fixture
 * is internally consistent. Replace with real digitized points later.
 */
const synthPoints = (a: number, b: number, rpms: number[]) =>
  rpms.map((rpm) => ({ rpm, value: Number((a * rpm + b).toFixed(4)) }));

const RPMS = [100, 175, 250, 325, 450];

export const RAW_CATALOG: RawCatalog = {
  version: '0.1.0-fixture',
  pumps: [
    {
      code: 'NM031--01L',
      name: 'NEMO NM031',
      series: 'BY',
      motorOptions: [{ motorKw: 1.5, gearboxModel: 'NS 27' }],
      limits: { rpmMin: 100, rpmMax: 450, pressureMaxBar: 6 },
      source: {
        document: 'NDB 106-06 (602)',
        catalogRevision: 'fixture',
        referenceFluid: 'water',
      },
      pressures: [
        {
          id: 'p0_2',
          label: '0-2 bar',
          bar: 2,
          minBar: 0,
          maxBar: 2,
          flowPoints: synthPoints(0.02, -1.0, RPMS),
          powerPoints: synthPoints(0.001, 0.1, RPMS),
        },
        {
          id: 'p4',
          label: '4 bar',
          bar: 4,
          minBar: 4,
          maxBar: 4,
          flowPoints: synthPoints(0.02, -2.0, RPMS),
          powerPoints: synthPoints(0.0015, 0.2, RPMS),
        },
        {
          id: 'p6',
          label: '6 bar',
          bar: 6,
          minBar: 6,
          maxBar: 6,
          flowPoints: synthPoints(0.02, -3.0, RPMS),
          powerPoints: synthPoints(0.002, 0.3, RPMS),
        },
      ],
    },
    {
      code: 'NM045--02L',
      name: 'NEMO NM045',
      series: 'BY',
      motorOptions: [
        { motorKw: 2.2, gearboxModel: 'NS 57' },
        { motorKw: 3.7, gearboxModel: 'NS 57' },
        { motorKw: 5.5, gearboxModel: 'NS 57' },
      ],
      limits: { rpmMin: 100, rpmMax: 400, pressureMaxBar: 6 },
      source: {
        document: 'NDB 106-06 (602)',
        catalogRevision: 'fixture',
        referenceFluid: 'water',
      },
      pressures: [
        {
          id: 'p0_2',
          label: '0-2 bar',
          bar: 2,
          minBar: 0,
          maxBar: 2,
          flowPoints: synthPoints(0.035, -1.5, [100, 175, 250, 325, 400]),
          powerPoints: synthPoints(0.0015, 0.15, [100, 175, 250, 325, 400]),
        },
        {
          id: 'p4',
          label: '4 bar',
          bar: 4,
          minBar: 4,
          maxBar: 4,
          flowPoints: synthPoints(0.035, -2.8, [100, 175, 250, 325, 400]),
          powerPoints: synthPoints(0.0022, 0.28, [100, 175, 250, 325, 400]),
        },
        {
          id: 'p6',
          label: '6 bar',
          bar: 6,
          minBar: 6,
          maxBar: 6,
          flowPoints: synthPoints(0.035, -4.1, [100, 175, 250, 325, 400]),
          powerPoints: synthPoints(0.003, 0.42, [100, 175, 250, 325, 400]),
        },
      ],
    },
  ],
};
