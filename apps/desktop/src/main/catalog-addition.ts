import { randomUUID } from 'node:crypto';
import {
  CatalogAdditionService,
  type CatalogAddPreviewResult,
  type CatalogAddResult,
  type CatalogAdditionAnalysis,
  type CatalogAdditionPolicy,
  type CatalogImportError,
  type PlantCatalogImporter,
  type PlantWriteInput,
  type IncrementalPlantCatalogRepository,
} from '@my-little-garden/core';

type Preview = {
  readonly records: readonly PlantWriteInput[];
  readonly analysis: CatalogAdditionAnalysis;
  readonly expiresAt: number;
};

function isAnalysis(
  value: CatalogAdditionAnalysis | readonly CatalogImportError[],
): value is CatalogAdditionAnalysis {
  return !Array.isArray(value);
}

/** Electron orchestration: parse input and own short-lived preview tokens. */
export class CatalogAdditionImportService {
  private readonly previews = new Map<string, Preview>();
  private readonly addition: CatalogAdditionService;

  constructor(
    repository: IncrementalPlantCatalogRepository,
    private readonly importer: PlantCatalogImporter,
  ) {
    this.addition = new CatalogAdditionService(repository);
  }

  async preview(
    filename: string,
    csv: string,
  ): Promise<CatalogAddPreviewResult> {
    if (!/\.csv$/iu.test(filename)) {
      return {
        ok: false,
        errors: [
          {
            code: 'invalid_file_type',
            field: 'file',
            message: 'Le fichier doit être au format .csv.',
          },
        ],
      };
    }
    const parsed = this.importer.importData(csv);
    if (!parsed.ok) {
      return parsed;
    }
    const records = parsed.records.map(({ plant }) => plant);
    const analysis = await this.addition.analyze(records);
    if (!isAnalysis(analysis)) {
      return { ok: false, errors: analysis };
    }
    const token = randomUUID();
    this.previews.set(token, {
      records,
      analysis,
      expiresAt: Date.now() + 5 * 60_000,
    });
    return {
      ok: true,
      token,
      created: analysis.created,
      unchanged: analysis.unchanged,
      conflicts: analysis.conflicts,
      impactedSelections: analysis.impactedSelections,
    };
  }

  async commit(
    token: string,
    policy: CatalogAdditionPolicy,
  ): Promise<CatalogAddResult> {
    const preview = this.previews.get(token);
    this.previews.delete(token);
    if (!preview || preview.expiresAt < Date.now()) {
      return {
        ok: false,
        errors: [
          {
            code: 'expired_preview',
            message:
              'La prévisualisation a expiré. Veuillez importer le fichier à nouveau.',
          },
        ],
      };
    }
    return this.addition.commit(preview.records, preview.analysis, policy);
  }
}
