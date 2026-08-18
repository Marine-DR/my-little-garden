/**
 * Returns placeholders for a non-empty, parameterized SQLite `IN` clause.
 *
 * Only placeholder tokens are generated here. Values must still be passed to
 * `StatementSync#get`, `all`, or `run`; never interpolate values into SQL.
 */
export function inClausePlaceholders(valueCount: number): string {
  if (!Number.isInteger(valueCount) || valueCount < 1) {
    throw new RangeError('An IN clause requires at least one value.');
  }
  return Array.from({ length: valueCount }, () => '?').join(', ');
}
