/**
 * Format an ISO timestamp (stored in UTC) as local pt-BR date/time.
 * The record keeps the ISO/UTC string for deterministic ordering; display is
 * localized here at the edge.
 */
export const formatLocalDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
};

/** Local time only (HH:MM:SS) for compact table cells. */
export const formatLocalTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
};
