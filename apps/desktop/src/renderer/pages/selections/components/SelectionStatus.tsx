import type { SelectionStatus as SelectionStatusValue } from '@my-little-garden/core';

const statusDetails: Record<
  SelectionStatusValue,
  { readonly icon: string; readonly label: string; readonly className: string }
> = {
  up_to_date: {
    icon: '✓',
    label: 'à jour',
    className: 'selection-status-up-to-date',
  },
  contains_modified_plants: {
    icon: '!',
    label: 'plantes modifiées',
    className: 'selection-status-modified',
  },
  contains_deleted_plants: {
    icon: '×',
    label: 'Contient des plantes supprimées',
    className: 'selection-status-deleted',
  },
};

export function SelectionStatus({
  status,
  modifiedPlantCount,
  deletedPlantCount,
}: {
  readonly status: SelectionStatusValue;
  readonly modifiedPlantCount?: number;
  readonly deletedPlantCount?: number;
}) {
  const details = statusDetails[status];
  return (
    <span className={`selection-status ${details.className}`}>
      <span className="selection-status-icon" aria-hidden="true">
        {details.icon}
      </span>{' '}
      {status === 'contains_modified_plants' && modifiedPlantCount !== undefined
        ? `${modifiedPlantCount} ${modifiedPlantCount === 1 ? 'plante modifiée' : details.label}`
        : status === 'contains_deleted_plants' &&
            deletedPlantCount !== undefined
          ? `${deletedPlantCount} ${deletedPlantCount === 1 ? 'plante supprimée' : 'plantes supprimées'}`
          : details.label}
    </span>
  );
}
