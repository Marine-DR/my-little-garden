import type {
  SelectionDetails,
  SelectionRepository,
} from '@my-little-garden/core';
import { deleteManagedPhotoFile } from '@my-little-garden/photo-handling';
import { acknowledgeDeletedSelectionPlants } from './catalog-view.js';

/** Electron orchestration for acknowledgement followed by safe file cleanup. */
export async function acknowledgeDeletedPlantsAndCleanup(
  selectionRepository: SelectionRepository,
  selectionId: string,
  photoDirectory: string,
): Promise<SelectionDetails | null> {
  const filenames = selectionRepository.listDeletedPhotoFilenames(selectionId);
  const selection = await acknowledgeDeletedSelectionPlants(
    selectionRepository,
    selectionId,
  );
  if (!selection) {
    return null;
  }
  for (const filename of filenames) {
    if (!selectionRepository.isPhotoFilenameReferenced(filename)) {
      deleteManagedPhotoFile(photoDirectory, filename);
    }
  }
  return selection;
}
