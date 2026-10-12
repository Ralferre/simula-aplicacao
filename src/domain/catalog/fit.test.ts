import { describe, expect, it } from 'vitest';
import { evaluateFit, fitCurve } from './fit';
import { hashContent, stableStringify } from './hash';
import { buildCatalog } from './build';

describe('fitCurve', () => {
  it('recovers a known slope and intercept with R2 ~ 1', () => {
    // value = 0.02*rpm - 2
    const points = [100, 200, 300, 400].map((rpm) => ({
      rpm,
      value: 0.02 * rpm - 2,
    }));
    const fit = fitCurve(points);
    expect(fit.a).toBeCloseTo(0.02, 10);
    expect(fit.b).toBeCloseTo(-2, 10);
    expect(fit.r2).toBeCloseTo(1, 10);
    expect(fit.rmse).toBeCloseTo(0, 10);
  });

  it('reports a lower R2 for noisy data', () => {
    const points = [
      { rpm: 100, value: 0 },
      { rpm: 200, value: 3 },
      { rpm: 300, value: 2 },
      { rpm: 400, value: 7 },
    ];
    const fit = fitCurve(points);
    expect(fit.r2).toBeLessThan(1);
    expect(fit.r2).toBeGreaterThan(0);
    expect(fit.rmse).toBeGreaterThan(0);
  });

  it('throws for fewer than 2 distinct RPMs', () => {
    expect(() => fitCurve([{ rpm: 100, value: 1 }])).toThrow();
    expect(() =>
      fitCurve([
        { rpm: 100, value: 1 },
        { rpm: 100, value: 2 },
      ]),
    ).toThrow();
  });

  it('evaluateFit matches the model', () => {
    expect(evaluateFit({ a: 0.02, b: -2, r2: 1, rmse: 0 }, 300)).toBeCloseTo(4, 10);
  });
});

describe('hashContent', () => {
  it('is independent of key order', () => {
    const h1 = hashContent({ a: 1, b: 2 });
    const h2 = hashContent({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });

  it('changes when content changes', () => {
    const h1 = hashContent({ a: 1 });
    const h2 = hashContent({ a: 2 });
    expect(h1).not.toBe(h2);
  });

  it('stableStringify sorts nested keys', () => {
    expect(stableStringify({ b: { d: 1, c: 2 }, a: 3 })).toBe(
      '{"a":3,"b":{"c":2,"d":1}}',
    );
  });
});

describe('buildCatalog', () => {
  it('produces a catalog whose stored hash matches a recompute', () => {
    const catalog = buildCatalog(undefined, '2026-01-01T00:00:00.000Z');
    expect(catalog.hash).toBe(hashContent(catalog.pumps));
    expect(catalog.pumps.length).toBeGreaterThan(0);
  });

  it('detects tampering: mutating pumps breaks the stored hash', () => {
    const catalog = buildCatalog(undefined, '2026-01-01T00:00:00.000Z');
    const tampered = structuredClone(catalog);
    tampered.pumps[0].pressures[0].flow.fit.a += 1;
    expect(hashContent(tampered.pumps)).not.toBe(catalog.hash);
  });

  it('fits each pressure curve with high R2 for the fixture', () => {
    const catalog = buildCatalog(undefined, '2026-01-01T00:00:00.000Z');
    for (const pump of catalog.pumps) {
      for (const p of pump.pressures) {
        expect(p.flow.fit.r2).toBeGreaterThan(0.99);
        expect(p.power.fit.r2).toBeGreaterThan(0.99);
      }
    }
  });
});
