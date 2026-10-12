import type { GA800Profile } from './model';

/**
 * Default GA800 profile fixture. Versioned, isolated from the user form.
 * H6-06/H6-07 parameterization pending confirmation (see PLANO_MVP_Rev01.md).
 */
export const DEFAULT_GA800_PROFILE: GA800Profile = {
  id: 'ga800-default',
  version: '0.1.0-fixture',
  h6_06: 'pulse-monitor',
  h6_07: 2.4,
  accelTimeS: 2,
  decelTimeS: 2,
  stoppingMethod: 'ramp',
  maxFrequencyHz: 60,
};
