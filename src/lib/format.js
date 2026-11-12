/** Formatting helpers. U.S. English, no em-dashes, trade nouns as the guide lists them. */

export const formatNumber = (n) => Number(n).toLocaleString('en-US');

export const formatYards = (yd) => `${formatNumber(yd)} yd`;

export const formatInches = (inches) => `${formatNumber(inches)} in`;

export const formatRubs = (rubs) => `${formatNumber(rubs)} Wyzenbeek double rubs`;

export const formatNrc = (nrc) => `NRC ${Number(nrc).toFixed(2)}`;

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Formats an ISO date (YYYY-MM-DD) as "Oct 14, 2026". Returns an empty string for a missing or invalid date. */
export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date);
}

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Formats an ISO date as "Oct 14" for tight card rows. */
export function formatShortDate(iso) {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? '' : SHORT_DATE_FORMAT.format(date);
}

/** Card fact line from the microcopy library: "{fiber}, {width} in, {yardage} yd". */
export const factLine = (lot) => `${lot.fiber}, ${formatInches(lot.width)}, ${formatYards(lot.yd)}`;

/** Joins non-empty parts with a middle dot. */
export const joinParts = (parts, separator = ' · ') => parts.filter(Boolean).join(separator);
