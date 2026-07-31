// @vitest-environment node

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  SelectionDetailsRecord,
  SelectionRepository,
} from '@my-little-garden/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { acknowledgeDeletedPlantsAndCleanup } from '../src/main/selection-deletion';

describe('deleted selection plant photo cleanup', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('removes only photos no longer referenced after acknowledgement', async () => {
    const photoDirectory = mkdtempSync(join(tmpdir(), 'garden-photos-'));
    directories.push(photoDirectory);
    writeFileSync(join(photoDirectory, 'unused.png'), 'unused');
    writeFileSync(join(photoDirectory, 'shared.png'), 'shared');
    const acknowledged: SelectionDetailsRecord = {
      id: 'selection-1',
      name: 'Massif',
      status: 'up_to_date',
      modifiedPlantCount: 0,
      deletedPlantCount: 0,
      modifiedPlants: [],
      deletedPlants: [],
      plants: [],
    };
    const repository = {
      listDeletedPhotoFilenames: vi.fn(() => ['unused.png', 'shared.png']),
      acknowledgeDeletedPlants: vi.fn(async () => acknowledged),
      isPhotoFilenameReferenced: vi.fn(
        (filename: string) => filename === 'shared.png',
      ),
    } as unknown as SelectionRepository;

    const result = await acknowledgeDeletedPlantsAndCleanup(
      repository,
      'selection-1',
      photoDirectory,
    );

    expect(result?.id).toBe('selection-1');
    expect(existsSync(join(photoDirectory, 'unused.png'))).toBe(false);
    expect(existsSync(join(photoDirectory, 'shared.png'))).toBe(true);
  });
});
