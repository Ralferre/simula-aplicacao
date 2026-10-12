/**
 * Shared test fixtures. These are synthetic and only for unit tests; they are
 * NOT the published catalog.
 */

import type { PumpCurve } from '../catalog/types';

/**
 * Build a fitted curve from a slope/intercept, generating consistent points.
 * value = a * rpm + b.
 */
const buildCurve = (a: number, b: number, rpms: number[]) => {
  const points = rpms.map((rpm) => ({ rpm, value: a * rpm + b }));
  return {
    points,
    fit: { a, b, r2: 1, rmse: 0 },
  };
};

/**
 * Synthetic NM031 fixture with three discrete pressure options including a
 * "0-2 bar" range label as a single option.
 */
export const NM031: PumpCurve = {
  code: 'NM031--01L',
  name: 'NEMO NM031',
  series: 'BY',
  motorOptions: [{ motorKw: 1.5, gearboxModel: 'NS 27' }],
  limits: { rpmMin: 100, rpmMax: 450, pressureMaxBar: 6 },
  source: {
    document: 'NDB 106-06 (602)',
    referenceFluid: 'water',
  },
  pressures: [
    {
      id: 'p0_2',
      label: '0-2 bar',
      bar: 2,
      minBar: 0,
      maxBar: 2,
      // Q = 0.02*n - 1 (m^3/h); power small
      flow: buildCurve(0.02, -1, [100, 250, 450]),
      power: buildCurve(0.001, 0.1, [100, 250, 450]),
    },
    {
      id: 'p4',
      label: '4 bar',
      bar: 4,
      minBar: 4,
      maxBar: 4,
      flow: buildCurve(0.02, -2, [100, 250, 450]),
      power: buildCurve(0.0015, 0.2, [100, 250, 450]),
    },
    {
      id: 'p6',
      label: '6 bar',
      bar: 6,
      minBar: 6,
      maxBar: 6,
      flow: buildCurve(0.02, -3, [100, 250, 450]),
      power: buildCurve(0.002, 0.3, [100, 250, 450]),
    },
  ],
};
