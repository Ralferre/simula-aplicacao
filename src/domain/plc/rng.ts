/**
 * Deterministic, seedable pseudo-random generator (mulberry32).
 *
 * Used by the plant model so that dosing simulations are reproducible for a
 * given seed. Not cryptographically secure — determinism is the only goal.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Approximately normal (Box-Muller) with the given mean and std. */
  normal(mean: number, std: number): number;
}

export const createRng = (seed: number): Rng => {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    normal: (mean, std) => {
      // Box-Muller using two uniforms.
      const u1 = Math.max(next(), Number.EPSILON);
      const u2 = next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + std * z;
    },
  };
};
