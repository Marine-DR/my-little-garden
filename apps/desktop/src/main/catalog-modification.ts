import { randomUUID } from 'node:crypto';
import {
  CatalogModificationService,
  type CatalogImportError,
  type CatalogModificationAnalysis,
  type CatalogModificationPolicy,
  type CatalogModifyPreviewResult,
  type CatalogModifyResult,
  type IncrementalPlantCatalogRepository,
  type PlantCatalogImporter,
  type PlantWriteInput,
} from '@my-little-garden/core';

type Preview = {
  readonly records: readonly PlantWriteInput[];
  readonly analysis: CatalogModificationAnalysis;
  readonly expiresAt: number;
};

function isAnalysis(
  value: CatalogModificationAnalysis | readonly CatalogImportError[],
): value is CatalogModificationAnalysis {
  return !Array.isArray(value);
}

/** Electron orchestration: parse input and own short-lived preview tokens. */
export class CatalogModificationImportService {
  private readonly previews = new Map<string, Preview>();
  private readonly modification: CatalogModificationService;

  constructor(
    repository: IncrementalPlantCatalogRepository,
    private readonly importer: PlantCatalogImporter,
  ) {
    this.modification = new CatalogModificationService(repository);
  }

  async preview(
    filename: string,
    csv: string,
  ): Promise<CatalogModifyPreviewResult> {
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
    const analysis = await this.modification.analyze(records);
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
      updated: analysis.updated,
      unchanged: analysis.unchanged,
      missing: analysis.missing,
      impactedSelections: analysis.impactedSelections,
    };
  }

  commit(
    token: string,
    policy: CatalogModificationPolicy,
  ): CatalogModifyResult {
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
    return this.modification.commit(preview.records, preview.analysis, policy);
  }
}
