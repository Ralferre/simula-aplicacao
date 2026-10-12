/**
 * Offline curve fitting for the hybrid catalog.
 *
 * Fits a linear model value = a*rpm + b to a set of digitized points using
 * ordinary least squares, and reports R^2 and RMSE. For positive-displacement
 * helical pumps the flow curve at a fixed pressure is well modeled by this
 * form, where a negative intercept captures slip.
 */

import type { CurvePoint, LinearFit } from './types';

/**
 * Ordinary least squares fit of value = a*rpm + b.
 * Throws if fewer than 2 distinct points are provided.
 */
export const fitCurve = (points: CurvePoint[]): LinearFit => {
  const n = points.length;
  if (n < 2) {
    throw new Error('fitCurve requires at least 2 points');
  }

  const distinctRpm = new Set(points.map((p) => p.rpm));
  if (distinctRpm.size < 2) {
    throw new Error('fitCurve requires at least 2 distinct RPM values');
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const { rpm, value } of points) {
    sumX += rpm;
    sumY += value;
    sumXY += rpm * value;
    sumXX += rpm * rpm;
  }

  const denom = n * sumXX - sumX * sumX;
  const a = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - a * sumX) / n;

  // Goodness of fit.
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const { rpm, value } of points) {
    const predicted = a * rpm + b;
    ssTot += (value - meanY) ** 2;
    ssRes += (value - predicted) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  const rmse = Math.sqrt(ssRes / n);

  return { a, b, r2, rmse };
};

/** Evaluate a fitted linear model at a given RPM. */
export const evaluateFit = (fit: LinearFit, rpm: number): number =>
  fit.a * rpm + fit.b;
