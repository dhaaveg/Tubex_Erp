/**
 * Standard Date & Time Formatters for Tubular ERP
 * Enforces DD-MM-YYYY format across all tables, badges, modals, previews, and exports.
 */

/**
 * Formats any Date object, ISO string, timestamp number, or date string into DD-MM-YYYY.
 * Guaranteed 2-digit day, 2-digit month, 4-digit year separated by hyphens.
 *
 * Handles YYYY-MM-DD strings directly to prevent UTC-to-local timezone day shifts.
 */
export function formatDate(d: string | number | Date | null | undefined, fallback: string = '—'): string {
  if (!d) return fallback;

  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (!trimmed) return fallback;

    // Direct extraction for YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss strings to avoid timezone drift
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}-${month}-${year}`;
    }

    // Already in DD-MM-YYYY
    const ddmmyyyyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyyMatch) {
      return trimmed;
    }
  }

  const date = typeof d === 'object' && d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) {
    return typeof d === 'string' ? d : fallback;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

/**
 * Formats any Date object, ISO string, or timestamp into DD-MM-YYYY HH:mm
 */
export function formatDateTime(d: string | number | Date | null | undefined, fallback: string = '—'): string {
  if (!d) return fallback;

  const date = typeof d === 'object' && d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) {
    return typeof d === 'string' ? d : fallback;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}-${month}-${year} ${hours}:${minutes}`;
}
