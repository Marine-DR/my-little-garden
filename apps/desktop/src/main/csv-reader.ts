export interface CsvRow {
  readonly values: string[];
  readonly lineNumber: number;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else value += character;
  }
  if (quoted) throw new Error('Guillemet non fermé dans le fichier CSV.');
  values.push(value);
  return values;
}

export function* readCsvRows(csv: string): Generator<CsvRow> {
  const content = csv.replace(/^\uFEFF/u, '');
  let lineNumber = 0;
  let start = 0;
  while (start <= content.length) {
    const newline = content.indexOf('\n', start);
    const end = newline === -1 ? content.length : newline;
    const line = content.slice(start, end).replace(/\r$/u, '');
    lineNumber += 1;
    if (line.trim()) yield { values: parseCsvLine(line), lineNumber };
    if (newline === -1) break;
    start = newline + 1;
  }
}
