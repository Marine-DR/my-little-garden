import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readCatalogCsvTemplate(): string {
  return readFileSync(
    join(__dirname, '..', 'resources', 'catalog-template.csv'),
    'utf8',
  );
}
