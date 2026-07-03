const COMBINING_MARKS = /\p{M}+/gu;
const REPEATED_WHITESPACE = /\s+/gu;

/**
 * Produces the comparison key persisted in normalized_name and
 * normalized_label columns.
 */
export function normalizeDatabaseKey(value: string): string {
  return value
    .trim()
    .replace(REPEATED_WHITESPACE, ' ')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase();
}

export const normalizePlantName = normalizeDatabaseKey;
export const normalizeVocabularyLabel = normalizeDatabaseKey;
