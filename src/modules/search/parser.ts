/* eslint-disable no-control-regex */
/**
 * Search query parser and sanitizer (docs/04 §7.8, docs/06 §2.2 API-CAT-30).
 * Prepares input search strings for PostgreSQL full-text search (`websearch_to_tsquery` or `plainto_tsquery`).
 */

/**
 * Sanitizes a raw search query string for safe full-text search.
 * Trims whitespace, removes control characters, and handles empty input.
 */
export function sanitizeSearchQuery(query?: string | null): string {
  if (!query) return "";
  // Strip control chars, null bytes, and normalize spaces
  return query
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts distinct terms from a search query for highlighting or token-based matching.
 */
export function extractSearchTerms(query: string): string[] {
  const sanitized = sanitizeSearchQuery(query);
  if (!sanitized) return [];

  // Match words or quoted phrases
  const matches = sanitized.match(/"([^"]+)"|(\S+)/g) ?? [];
  const terms: string[] = [];

  for (const match of matches) {
    const term = match.replace(/^"|"$/g, "").trim().toLowerCase();
    if (term.length > 0 && !terms.includes(term)) {
      terms.push(term);
    }
  }

  return terms;
}

/**
 * Prepares a query string for PostgreSQL `websearch_to_tsquery('english', ...)`.
 * Retains basic operators (OR, "-", quotes) if well-formed, or safely wraps.
 */
export function toWebsearchQuery(query: string): string {
  const sanitized = sanitizeSearchQuery(query);
  if (!sanitized) return "";

  // Balance unpaired double quotes so websearch_to_tsquery doesn't choke
  const quoteCount = (sanitized.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    return `${sanitized}"`;
  }

  return sanitized;
}
