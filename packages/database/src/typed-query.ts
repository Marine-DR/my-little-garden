import type {
  DatabaseSync,
  SQLInputValue,
  SQLOutputValue,
  StatementSync,
} from 'node:sqlite';

export type SqliteRow = Record<string, SQLOutputValue>;
export type RowDecoder<Row> = (row: SqliteRow) => Row;

export class TypedQuery<Parameters extends SQLInputValue[], Row> {
  private readonly statement: StatementSync;

  constructor(
    database: DatabaseSync,
    sql: string,
    private readonly decode: RowDecoder<Row>,
  ) {
    this.statement = database.prepare(sql);
  }

  all(...parameters: Parameters): Row[] {
    return this.statement.all(...parameters).map(this.decode);
  }

  get(...parameters: Parameters): Row | null {
    const row = this.statement.get(...parameters);
    return row ? this.decode(row) : null;
  }
}

export function stringColumn(row: SqliteRow, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') {
    throw new TypeError(`Expected ${column} to be a string.`);
  }
  return value;
}

export function nullableStringColumn(
  row: SqliteRow,
  column: string,
): string | null {
  const value = row[column];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new TypeError(`Expected ${column} to be a string or null.`);
  }
  return value;
}

export function numberColumn(row: SqliteRow, column: string): number {
  const value = row[column];
  if (typeof value !== 'number') {
    throw new TypeError(`Expected ${column} to be a number.`);
  }
  return value;
}

export function nullableNumberColumn(
  row: SqliteRow,
  column: string,
): number | null {
  const value = row[column];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number') {
    throw new TypeError(`Expected ${column} to be a number or null.`);
  }
  return value;
}
