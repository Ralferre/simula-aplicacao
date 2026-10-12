import { describe, expect, it } from 'vitest';
import { formatLocalDateTime, formatLocalTime } from './formatDate';

describe('formatLocalDateTime', () => {
  it('formats a valid ISO timestamp into pt-BR local date/time', () => {
    const out = formatLocalDateTime('2026-01-02T03:04:05.000Z');
    // Format: dd/mm/yyyy hh:mm:ss (local tz). Assert structure, not the tz value.
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4}[ ,]+\d{2}:\d{2}:\d{2}$/);
  });

  it('returns the raw string for an invalid date', () => {
    expect(formatLocalDateTime('not-a-date')).toBe('not-a-date');
  });

  it('formatLocalTime returns HH:MM:SS', () => {
    expect(formatLocalTime('2026-01-02T03:04:05.000Z')).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('is a deterministic transform for a fixed input', () => {
    const a = formatLocalDateTime('2026-06-15T12:30:00.000Z');
    const b = formatLocalDateTime('2026-06-15T12:30:00.000Z');
    expect(a).toBe(b);
  });
});
