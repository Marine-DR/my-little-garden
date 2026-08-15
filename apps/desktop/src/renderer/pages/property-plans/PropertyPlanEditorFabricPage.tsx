import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BoundaryEdgeKind,
  CatalogPlant,
  PropertyBoundaryPoint,
  PropertyPlanDesign,
  PropertyPlanSaveInput,
  SelectionDetails,
  SelectionSummary,
} from '@my-little-garden/core';
import { PlantPhoto } from '../../components/PlantPhoto';
import { catalogColorToCss } from './catalog-color';
import {
  FabricPlanCanvas,
  type FabricPlanCanvasHandle,
} from './FabricPlanCanvas';
import {
  applyCanvasChanges,
  boundsFromPoints,
  createEditorDocument,
  duplicateObjects,
  edgeCurvatureOf,
  edgeKindOf,
  insertPointAfter,
  nextDraftId,
  pointInsidePolygon,
  rectangularBoundary,
  sampleBoundary,
  validatePlan,
  type BoundaryOwner,
  type EditorPlacement,
  type EditorPoint,
  type PlanCanvasChange,
  type PlanEditorDocument,
  type SelectedBoundaryEdge,
} from '@my-little-garden/core';

const DEFAULT_WIDTH_CM = 400;
const DEFAULT_HEIGHT_CM = 250;
const PAN_STEP_PX = 80;

type Toast = {
  readonly message: string;
  readonly undoable?: boolean;
};

function positiveDimension(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 20 ? parsed : fallback;
}

function colorsOf(plant: CatalogPlant): readonly string[] {
  return [...new Set([...plant.flowerColors, ...plant.leafColors])];
}

function firstPlantColor(plant: CatalogPlant): string | null {
  return colorsOf(plant)[0] ?? null;
}

function documentsEqual(
  first: PlanEditorDocument,
  second: PlanEditorDocument,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function boundaryFor(
  document: PlanEditorDocument,
  owner: BoundaryOwner,
): readonly PropertyBoundaryPoint[] {
  return owner.kind === 'property'
    ? document.propertyBoundaryPoints
    : (document.flowerbeds.find((item) => item.id === owner.id)
        ?.boundaryPoints ?? []);
}

function replaceBoundary(
  document: PlanEditorDocument,
  owner: BoundaryOwner,
  points: readonly PropertyBoundaryPoint[],
): PlanEditorDocument {
  if (owner.kind === 'property') {
    return { ...document, propertyBoundaryPoints: points };
  }
  const primaryFlowerbedId = document.flowerbeds[0]?.id;
  return {
    ...document,
    propertyBoundaryPoints:
      owner.id === primaryFlowerbedId
        ? points
        : document.propertyBoundaryPoints,
    flowerbeds: document.flowerbeds.map((flowerbed) =>
      flowerbed.id === owner.id
        ? { ...flowerbed, ...boundsFromPoints(points), boundaryPoints: points }
        : flowerbed,
    ),
  };
}

function placementAt(
  plant: CatalogPlant,
  point: EditorPoint,
  color: string | null,
  document: PlanEditorDocument,
  id = nextDraftId('plant'),
): EditorPlacement | null {
  if (!plant.spacingCm) {
    return null;
  }
  const flowerbedId =
    document.flowerbeds.find((flowerbed) =>
      pointInsidePolygon(point, sampleBoundary(flowerbed.boundaryPoints)),
    )?.id ?? null;
  return {
    id,
    flowerbedId,
    plantId: plant.id,
    plantNameSnapshot: plant.name,
    spacingCmSnapshot: plant.spacingCm,
    colorSnapshot: color,
    xCm: point.xCm,
    yCm: point.yCm,
  };
}

export function PropertyPlanEditorPage({
  propertyPlan,
  onClose,
  onSaved,
}: {
  readonly propertyPlan: PropertyPlanDesign | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const initialWidth = propertyPlan?.widthCm ?? DEFAULT_WIDTH_CM;
  const initialHeight = propertyPlan?.heightCm ?? DEFAULT_HEIGHT_CM;
  const [name, setName] = useState(propertyPlan?.name ?? '');
  const [widthCm, setWidthCm] = useState(initialWidth);
  const [heightCm, setHeightCm] = useState(initialHeight);
  const [selectionId, setSelectionId] = useState(
    propertyPlan?.selectionId ?? '',
  );
  const [selections, setSelections] = useState<readonly SelectionSummary[]>([]);
  const [selection, setSelection] = useState<SelectionDetails | null>(null);
  const [document, setDocument] = useState(() =>
    createEditorDocument(propertyPlan, initialWidth, initialHeight),
  );
  const documentRef = useRef(document);
  const undoStackRef = useRef<PlanEditorDocument[]>([]);
  const redoStackRef = useRef<PlanEditorDocument[]>([]);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SelectedBoundaryEdge | null>(
    null,
  );
  const [plantSearch, setPlantSearch] = useState('');
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [chosenColors, setChosenColors] = useState<
    Record<string, string | null>
  >({});
  const [draggedPlant, setDraggedPlant] = useState<CatalogPlant | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dirty, setDirty] = useState(propertyPlan === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showDimensions, setShowDimensions] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showBuyingDetails, setShowBuyingDetails] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);
  const [warningsDismissed, setWarningsDismissed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    readonly id: string;
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const canvasRef = useRef<FabricPlanCanvasHandle>(null);

  const replaceDocument = useCallback(
    (
      nextDocument: PlanEditorDocument,
      options?: {
        readonly selectedPlantId?: string | null;
        readonly toast?: Toast;
      },
    ): void => {
      const current = documentRef.current;
      if (documentsEqual(current, nextDocument)) {
        return;
      }
      undoStackRef.current.push(current);
      redoStackRef.current = [];
      documentRef.current = nextDocument;
      setDocument(nextDocument);
      setDirty(true);
      setWarningsDismissed(false);
      setHistory({ canUndo: true, canRedo: false });
      if (options && 'selectedPlantId' in options) {
        setSelectedPlantId(options.selectedPlantId ?? null);
      }
      if (options?.toast) {
        setToast(options.toast);
      }
    },
    [],
  );

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) {
      return;
    }
    redoStackRef.current.push(documentRef.current);
    documentRef.current = previous;
    setDocument(previous);
    setSelectedPlantId(null);
    setSelectedEdge(null);
    setDirty(true);
    setHistory({
      canUndo: undoStackRef.current.length > 0,
      canRedo: true,
    });
    setToast(null);
  }, []);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) {
      return;
    }
    undoStackRef.current.push(documentRef.current);
    documentRef.current = next;
    setDocument(next);
    setSelectedPlantId(null);
    setSelectedEdge(null);
    setDirty(true);
    setHistory({ canUndo: true, canRedo: redoStackRef.current.length > 0 });
  }, []);

  useEffect(() => {
    void window.selectionService
      .listSelections()
      .then(setSelections)
      .catch(() => setError('Les sélections n’ont pas pu être chargées.'));
  }, []);

  useEffect(() => {
    if (!selectionId) {
      return;
    }
    let active = true;
    void window.selectionService
      .getSelection(selectionId)
      .then((result) => {
        if (active) {
          setSelection(result);
        }
      })
      .catch(() => {
        if (active) {
          setError('Les plantes de la sélection n’ont pas pu être chargées.');
        }
      });
    return () => {
      active = false;
    };
  }, [selectionId]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const validation = useMemo(() => validatePlan(document), [document]);
  const warningIds = useMemo(
    () => new Set([...validation.overlappingIds, ...validation.outsideIds]),
    [validation],
  );
  const filteredPlants = useMemo(() => {
    const query = plantSearch.trim().toLocaleLowerCase('fr-FR');
    return (
      selection?.plants.filter((plant) =>
        plant.name.toLocaleLowerCase('fr-FR').includes(query),
      ) ?? []
    );
  }, [plantSearch, selection]);

  const selectedPlacement =
    document.placements.find((item) => item.id === selectedPlantId) ?? null;
  const selectedCatalogPlant =
    selection?.plants.find(
      (plant) => plant.id === selectedPlacement?.plantId,
    ) ?? null;
  const selectedPlantStatus = selectedPlacement
    ? validation.overlappingIds.has(selectedPlacement.id) &&
      validation.outsideIds.has(selectedPlacement.id)
      ? 'Chevauchement et espace requis hors limites'
      : validation.overlappingIds.has(selectedPlacement.id)
        ? `Chevauchement avec ${
            validation.overlapPartners.get(selectedPlacement.id)?.length ?? 1
          } plante(s)`
        : validation.outsideIds.has(selectedPlacement.id)
          ? 'L’espace requis dépasse du parterre'
          : 'Espacement respecté'
    : null;
  const selectedEdgePoint = selectedEdge
    ? boundaryFor(document, selectedEdge.owner)[selectedEdge.index]
    : null;

  const buyingList = useMemo(() => {
    const entries = new Map<
      string,
      {
        name: string;
        count: number;
        colors: Map<string, number>;
      }
    >();
    document.placements.forEach((placement) => {
      const key = placement.plantId ?? placement.plantNameSnapshot;
      const entry = entries.get(key) ?? {
        name: placement.plantNameSnapshot,
        count: 0,
        colors: new Map<string, number>(),
      };
      entry.count += 1;
      const color = placement.colorSnapshot ?? 'Non précisée';
      entry.colors.set(color, (entry.colors.get(color) ?? 0) + 1);
      entries.set(key, entry);
    });
    return [...entries.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr'),
    );
  }, [document.placements]);

  const handlePlantMoved = useCallback(
    (change: PlanCanvasChange) => {
      if (change.kind !== 'plant') {
        return;
      }
      const next = applyCanvasChanges(documentRef.current, [change]);
      const nextValidation = validatePlan(next);
      const invalid =
        nextValidation.overlappingIds.has(change.id) ||
        nextValidation.outsideIds.has(change.id);
      replaceDocument(next, {
        selectedPlantId: change.id,
        toast: invalid
          ? {
              message: 'Position enregistrée avec un avertissement.',
              undoable: true,
            }
          : undefined,
      });
    },
    [replaceDocument],
  );

  const handleBoundaryNodeMoved = useCallback(
    (owner: BoundaryOwner, index: number, point: EditorPoint) => {
      const points = boundaryFor(documentRef.current, owner);
      const nextPoints = points.map((current, pointIndex) =>
        pointIndex === index ? { ...current, ...point } : current,
      );
      replaceDocument(replaceBoundary(documentRef.current, owner, nextPoints));
      if (
        owner.kind === 'flowerbed' &&
        documentRef.current.flowerbeds[0]?.id === owner.id
      ) {
        const bounds = boundsFromPoints(nextPoints);
        setWidthCm(Math.round(bounds.widthCm));
        setHeightCm(Math.round(bounds.heightCm));
      }
    },
    [replaceDocument],
  );

  const updateSelectedEdge = useCallback(
    (update: (point: PropertyBoundaryPoint) => PropertyBoundaryPoint) => {
      if (!selectedEdge) {
        return;
      }
      const points = boundaryFor(documentRef.current, selectedEdge.owner);
      const nextPoints = points.map((point, index) =>
        index === selectedEdge.index ? update(point) : point,
      );
      replaceDocument(
        replaceBoundary(documentRef.current, selectedEdge.owner, nextPoints),
      );
    },
    [replaceDocument, selectedEdge],
  );

  const setEdgeKind = (kind: BoundaryEdgeKind): void => {
    updateSelectedEdge((point) =>
      kind === 'line'
        ? { xCm: point.xCm, yCm: point.yCm, edgeKind: 'line', edgeCurvature: 0 }
        : {
            ...point,
            edgeKind: kind,
            edgeCurvature:
              edgeKindOf(point) === 'line' ? 0.2 : edgeCurvatureOf(point),
          },
    );
  };

  const splitSelectedEdge = (): void => {
    if (!selectedEdge) {
      return;
    }
    const points = boundaryFor(documentRef.current, selectedEdge.owner);
    const nextPoints = insertPointAfter(points, selectedEdge.index);
    replaceDocument(
      replaceBoundary(documentRef.current, selectedEdge.owner, nextPoints),
    );
    setSelectedEdge({ ...selectedEdge, index: selectedEdge.index + 1 });
  };

  const placePlant = useCallback(
    (plant: CatalogPlant, point: EditorPoint): void => {
      const placement = placementAt(
        plant,
        point,
        chosenColors[plant.id] ?? firstPlantColor(plant),
        documentRef.current,
      );
      if (!placement) {
        return;
      }
      const next = {
        ...documentRef.current,
        placements: [...documentRef.current.placements, placement],
      };
      const nextValidation = validatePlan(next);
      const invalid =
        nextValidation.outsideIds.has(placement.id) ||
        nextValidation.overlappingIds.has(placement.id);
      replaceDocument(next, {
        selectedPlantId: placement.id,
        toast: {
          message: invalid
            ? 'Plante ajoutée avec un avertissement.'
            : `${plant.name} ajoutée au plan.`,
          undoable: true,
        },
      });
      setSelectedEdge(null);
    },
    [chosenColors, replaceDocument],
  );

  const deletePlant = useCallback(
    (id: string) => {
      replaceDocument(
        {
          ...documentRef.current,
          placements: documentRef.current.placements.filter(
            (item) => item.id !== id,
          ),
        },
        {
          selectedPlantId: null,
          toast: { message: 'Plante supprimée.', undoable: true },
        },
      );
      setContextMenu(null);
    },
    [replaceDocument],
  );

  const duplicatePlant = useCallback(
    (id: string) => {
      const result = duplicateObjects(documentRef.current, [`plant:${id}`], 10);
      const duplicatedId =
        result.selectedIds[0]?.slice('plant:'.length) ?? null;
      replaceDocument(result.document, {
        selectedPlantId: duplicatedId,
        toast: { message: 'Plante dupliquée.', undoable: true },
      });
      setContextMenu(null);
    },
    [replaceDocument],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, button')) {
        return;
      }
      const commandKey = event.ctrlKey || event.metaKey;
      if (commandKey && event.key.toLocaleLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (commandKey && event.key.toLocaleLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (
        commandKey &&
        event.key.toLocaleLowerCase() === 'd' &&
        selectedPlantId
      ) {
        event.preventDefault();
        duplicatePlant(selectedPlantId);
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedPlantId
      ) {
        event.preventDefault();
        deletePlant(selectedPlantId);
      } else if (event.key === 'Escape') {
        setSelectedPlantId(null);
        setSelectedEdge(null);
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletePlant, duplicatePlant, redo, selectedPlantId, undo]);

  const save = useCallback(async (): Promise<boolean> => {
    if (
      !name.trim() ||
      !selectionId ||
      documentRef.current.flowerbeds.length === 0
    ) {
      setError(
        'Indiquez un nom, choisissez une sélection et définissez le parterre.',
      );
      return false;
    }
    setSaving(true);
    setError(null);
    const current = documentRef.current;
    const primaryBoundary =
      current.flowerbeds[0]?.boundaryPoints ??
      rectangularBoundary(widthCm, heightCm);
    const input: PropertyPlanSaveInput = {
      id: propertyPlan?.id,
      name: name.trim(),
      selectionId,
      widthCm,
      heightCm,
      propertyBoundaryPoints: primaryBoundary,
      flowerbeds: current.flowerbeds.map((flowerbed) => ({
        id: flowerbed.id,
        xCm: flowerbed.xCm,
        yCm: flowerbed.yCm,
        widthCm: flowerbed.widthCm,
        heightCm: flowerbed.heightCm,
        boundaryPoints: flowerbed.boundaryPoints,
      })),
      placements: current.placements,
    };
    try {
      await window.propertyPlanService.savePropertyPlan(input);
      setDirty(false);
      setToast({
        message:
          warningIds.size > 0
            ? `Plan enregistré avec ${warningIds.size} avertissement(s).`
            : 'Plan enregistré.',
      });
      onSaved();
      return true;
    } catch {
      setError('Le plan n’a pas pu être enregistré.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    heightCm,
    name,
    onSaved,
    propertyPlan?.id,
    selectionId,
    warningIds.size,
    widthCm,
  ]);

  const requestClose = (): void => {
    if (dirty) {
      setShowLeaveDialog(true);
    } else {
      onClose();
    }
  };

  const applyDimensions = (nextWidth: number, nextHeight: number): void => {
    const boundaryPoints = rectangularBoundary(nextWidth, nextHeight);
    const primaryFlowerbed = documentRef.current.flowerbeds[0];
    setWidthCm(nextWidth);
    setHeightCm(nextHeight);
    replaceDocument({
      ...documentRef.current,
      propertyBoundaryPoints: boundaryPoints,
      flowerbeds: documentRef.current.flowerbeds.map((flowerbed) =>
        flowerbed.id === primaryFlowerbed?.id
          ? {
              ...flowerbed,
              xCm: 0,
              yCm: 0,
              widthCm: nextWidth,
              heightCm: nextHeight,
              boundaryPoints,
            }
          : flowerbed,
      ),
    });
    setShowDimensions(false);
    setToast({
      message:
        'Dimensions mises à jour. Les plantes sont conservées ; vérifiez les avertissements.',
    });
    window.setTimeout(() => canvasRef.current?.fitToPlan(), 0);
  };

  const previewDraggedPlant = (clientX: number, clientY: number): void => {
    if (!draggedPlant?.spacingCm) {
      return;
    }
    const point = canvasRef.current?.clientToPlan(clientX, clientY);
    if (!point) {
      return;
    }
    const candidate = placementAt(
      draggedPlant,
      point,
      chosenColors[draggedPlant.id] ?? firstPlantColor(draggedPlant),
      documentRef.current,
      '__preview__',
    );
    if (!candidate) {
      return;
    }
    const previewDocument = {
      ...documentRef.current,
      placements: [...documentRef.current.placements, candidate],
    };
    const previewValidation = validatePlan(previewDocument);
    const overlapping = previewValidation.overlappingIds.has(candidate.id);
    const outside = previewValidation.outsideIds.has(candidate.id);
    canvasRef.current?.showPlantPreview({
      point,
      spacingCm: candidate.spacingCmSnapshot,
      color: candidate.colorSnapshot,
      status:
        overlapping && outside
          ? 'both'
          : overlapping
            ? 'overlap'
            : outside
              ? 'outside'
              : 'valid',
    });
  };

  return (
    <section className="flowerbed-editor fabric-editor planner-editor">
      <header className="planner-header">
        <button type="button" className="planner-back" onClick={requestClose}>
          ← Retour
        </button>
        <label className="planner-name">
          <span className="sr-only">Nom du parterre</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setDirty(true);
            }}
            placeholder="Nom du parterre"
          />
        </label>
        <span className={`planner-save-state ${dirty ? 'dirty' : ''}`}>
          {saving
            ? 'Enregistrement…'
            : dirty
              ? 'Modifications non enregistrées'
              : 'Enregistré'}
        </span>
        <button
          type="button"
          className="primary-button"
          disabled={saving}
          onClick={() => void save()}
        >
          Enregistrer
        </button>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="planner-toolbar" aria-label="Outils du plan">
        <div className="planner-toolbar-group">
          <button type="button" onClick={() => setShowDimensions(true)}>
            Dimensions
          </button>
          <span>
            {widthCm} × {heightCm} cm
          </span>
        </div>
        <div className="planner-toolbar-group">
          <button type="button" disabled={!history.canUndo} onClick={undo}>
            ↶ Annuler
          </button>
          <button type="button" disabled={!history.canRedo} onClick={redo}>
            ↷ Rétablir
          </button>
        </div>
        <div className="planner-toolbar-group planner-view-controls">
          <button
            type="button"
            aria-label="Zoom arrière"
            onClick={() => canvasRef.current?.zoomOut()}
          >
            −
          </button>
          <button type="button" onClick={() => canvasRef.current?.resetZoom()}>
            {Math.round(zoom * 100)} %
          </button>
          <button
            type="button"
            aria-label="Zoom avant"
            onClick={() => canvasRef.current?.zoomIn()}
          >
            +
          </button>
          <button type="button" onClick={() => canvasRef.current?.fitToPlan()}>
            Ajuster
          </button>
        </div>
        <span
          className={`planner-status-chip ${
            warningIds.size > 0 ? 'warning' : 'valid'
          }`}
        >
          {warningIds.size > 0
            ? `${warningIds.size} à vérifier`
            : 'Plan valide'}
        </span>
      </div>

      {warningIds.size > 0 && !warningsDismissed ? (
        <div className="planner-warning-banner" role="alert">
          <span>
            {validation.overlappingIds.size} chevauchement(s),{' '}
            {validation.outsideIds.size} plante(s) hors limites.
          </span>
          <button type="button" onClick={() => setShowWarnings(true)}>
            Examiner
          </button>
          <button
            type="button"
            aria-label="Masquer l’avertissement"
            onClick={() => setWarningsDismissed(true)}
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="planner-layout">
        <aside
          className={`planner-plant-sidebar ${
            paletteCollapsed ? 'collapsed' : ''
          }`}
          aria-label="Palette de plantes"
        >
          <div className="planner-panel-heading">
            <div>
              <h2>Plantes</h2>
              <small>{selection?.plants.length ?? 0} disponibles</small>
            </div>
            <button
              type="button"
              aria-label={
                paletteCollapsed
                  ? 'Déployer les plantes'
                  : 'Replier les plantes'
              }
              onClick={() => setPaletteCollapsed((value) => !value)}
            >
              {paletteCollapsed ? '›' : '‹'}
            </button>
          </div>
          {!paletteCollapsed ? (
            <>
              <label className="planner-selection-field">
                Sélection
                <select
                  value={selectionId}
                  onChange={(event) => {
                    setSelectionId(event.target.value);
                    setSelection(null);
                    setDirty(true);
                  }}
                >
                  <option value="">Choisir une sélection</option>
                  {selections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <input
                className="planner-plant-search"
                type="search"
                placeholder="Rechercher une plante"
                value={plantSearch}
                onChange={(event) => setPlantSearch(event.target.value)}
              />
              <div className="planner-plant-list">
                {!selectionId ? (
                  <p>Choisissez une sélection pour afficher ses plantes.</p>
                ) : null}
                {selectionId && filteredPlants.length === 0 ? (
                  <p>Aucune plante ne correspond.</p>
                ) : null}
                {filteredPlants.map((plant) => {
                  const colors = colorsOf(plant);
                  const color =
                    chosenColors[plant.id] ?? firstPlantColor(plant);
                  const draggable = plant.spacingCm !== null;
                  return (
                    <article
                      key={plant.id}
                      className={`planner-plant-card ${
                        draggable ? '' : 'disabled'
                      }`}
                      draggable={draggable}
                      onDragStart={(event) => {
                        if (!draggable) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.effectAllowed = 'copy';
                        event.dataTransfer.setData('text/plain', plant.id);
                        setDraggedPlant(plant);
                      }}
                      onDragEnd={() => {
                        setDraggedPlant(null);
                        canvasRef.current?.hidePlantPreview();
                      }}
                    >
                      <div className="planner-plant-photo">
                        <PlantPhoto name={plant.name} url={plant.photoUrl} />
                      </div>
                      <div className="planner-plant-card-body">
                        <strong>{plant.name}</strong>
                        <small>
                          {plant.spacingCm
                            ? `Espacement ${plant.spacingCm} cm`
                            : 'Espacement manquant'}
                        </small>
                        <div className="planner-color-row">
                          {colors.length === 0 ? (
                            <span className="planner-color-empty">
                              Couleur libre
                            </span>
                          ) : (
                            colors.map((item) => (
                              <button
                                key={item}
                                type="button"
                                title={item}
                                aria-label={`Choisir ${item} pour ${plant.name}`}
                                aria-pressed={color === item}
                                className={color === item ? 'selected' : ''}
                                style={{ background: catalogColorToCss(item) }}
                                onPointerDown={(event) =>
                                  event.stopPropagation()
                                }
                                onClick={() =>
                                  setChosenColors((current) => ({
                                    ...current,
                                    [plant.id]: item,
                                  }))
                                }
                              />
                            ))
                          )}
                        </div>
                      </div>
                      <span className="planner-drag-handle" aria-hidden="true">
                        ⠿
                      </span>
                    </article>
                  );
                })}
              </div>
            </>
          ) : null}
        </aside>

        <main
          className="planner-canvas-column"
          onDragOver={(event) => {
            if (!draggedPlant) {
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            previewDraggedPlant(event.clientX, event.clientY);
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            ) {
              canvasRef.current?.hidePlantPreview();
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            canvasRef.current?.hidePlantPreview();
            const point = canvasRef.current?.clientToPlan(
              event.clientX,
              event.clientY,
            );
            if (draggedPlant && point) {
              placePlant(draggedPlant, point);
            }
            setDraggedPlant(null);
          }}
        >
          <div className="planner-canvas-shell">
            <FabricPlanCanvas
              ref={canvasRef}
              document={document}
              validation={validation}
              selectedPlantId={selectedPlantId}
              selectedEdge={selectedEdge}
              onPlantSelect={(id) => {
                setSelectedPlantId(id);
                setContextMenu(null);
              }}
              onEdgeSelect={setSelectedEdge}
              onPlantMoved={handlePlantMoved}
              onBoundaryNodeMoved={handleBoundaryNodeMoved}
              onPlantContextMenu={(id, position) => {
                setSelectedPlantId(id);
                setSelectedEdge(null);
                setContextMenu({ id, ...position });
              }}
              onZoomChange={setZoom}
            />
            <div className="flowerbed-pan-pad" aria-label="Déplacer la vue">
              <button
                type="button"
                className="pan-up"
                aria-label="Déplacer la vue vers le haut"
                onClick={() => canvasRef.current?.panBy(0, PAN_STEP_PX)}
              >
                ↑
              </button>
              <button
                type="button"
                className="pan-left"
                aria-label="Déplacer la vue vers la gauche"
                onClick={() => canvasRef.current?.panBy(PAN_STEP_PX, 0)}
              >
                ←
              </button>
              <button
                type="button"
                className="pan-center"
                aria-label="Centrer la vue"
                onClick={() => canvasRef.current?.fitToPlan()}
              >
                ◎
              </button>
              <button
                type="button"
                className="pan-right"
                aria-label="Déplacer la vue vers la droite"
                onClick={() => canvasRef.current?.panBy(-PAN_STEP_PX, 0)}
              >
                →
              </button>
              <button
                type="button"
                className="pan-down"
                aria-label="Déplacer la vue vers le bas"
                onClick={() => canvasRef.current?.panBy(0, -PAN_STEP_PX)}
              >
                ↓
              </button>
            </div>
          </div>
          <p className="planner-canvas-help">
            Déplacez directement les points de contour et les plantes. Cliquez
            sur une bordure pour changer sa courbe. Alt-glisser déplace la vue.
          </p>
        </main>

        <aside className="planner-summary-panel" aria-label="Détails du plan">
          {selectedPlacement ? (
            <section>
              <span className="planner-panel-kicker">Plante sélectionnée</span>
              {selectedCatalogPlant ? (
                <div className="planner-selected-plant-photo">
                  <PlantPhoto
                    name={selectedCatalogPlant.name}
                    url={selectedCatalogPlant.photoUrl}
                  />
                </div>
              ) : null}
              <h2>{selectedPlacement.plantNameSnapshot}</h2>
              <p>Cercle requis : Ø {selectedPlacement.spacingCmSnapshot} cm</p>
              <p
                className={`planner-selected-status ${
                  validation.overlappingIds.has(selectedPlacement.id)
                    ? 'overlap'
                    : validation.outsideIds.has(selectedPlacement.id)
                      ? 'outside'
                      : 'valid'
                }`}
              >
                {selectedPlantStatus}
              </p>
              <label>
                Couleur
                <select
                  value={selectedPlacement.colorSnapshot ?? ''}
                  onChange={(event) => {
                    const value = event.target.value || null;
                    replaceDocument({
                      ...documentRef.current,
                      placements: documentRef.current.placements.map((item) =>
                        item.id === selectedPlacement.id
                          ? { ...item, colorSnapshot: value }
                          : item,
                      ),
                    });
                  }}
                >
                  <option value="">Non précisée</option>
                  {(selectedCatalogPlant
                    ? colorsOf(selectedCatalogPlant)
                    : []
                  ).map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </label>
              <dl className="planner-position-details">
                <div>
                  <dt>X</dt>
                  <dd>{Math.round(selectedPlacement.xCm)} cm</dd>
                </div>
                <div>
                  <dt>Y</dt>
                  <dd>{Math.round(selectedPlacement.yCm)} cm</dd>
                </div>
              </dl>
              <div className="planner-detail-actions">
                <button
                  type="button"
                  onClick={() => duplicatePlant(selectedPlacement.id)}
                >
                  Dupliquer
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => deletePlant(selectedPlacement.id)}
                >
                  Supprimer
                </button>
              </div>
            </section>
          ) : selectedEdge && selectedEdgePoint ? (
            <section>
              <span className="planner-panel-kicker">Bordure sélectionnée</span>
              <h2>Limite du parterre</h2>
              <label>
                Nature du segment
                <select
                  value={edgeKindOf(selectedEdgePoint)}
                  onChange={(event) =>
                    setEdgeKind(event.target.value as BoundaryEdgeKind)
                  }
                >
                  <option value="line">Droite</option>
                  <option value="circular-arc">Arc circulaire</option>
                  <option value="elliptical-arc">Arc elliptique</option>
                  <option value="bezier">Courbe de Bézier</option>
                </select>
              </label>
              {edgeKindOf(selectedEdgePoint) !== 'line' ? (
                <label>
                  Courbure
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.01"
                    value={edgeCurvatureOf(selectedEdgePoint)}
                    onChange={(event) =>
                      updateSelectedEdge((point) => ({
                        ...point,
                        edgeCurvature: Number(event.target.value),
                      }))
                    }
                  />
                  <small>
                    {Math.round(edgeCurvatureOf(selectedEdgePoint) * 100)} %
                  </small>
                </label>
              ) : null}
              <div className="planner-detail-actions">
                {edgeKindOf(selectedEdgePoint) !== 'line' ? (
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedEdge((point) => ({
                        ...point,
                        edgeCurvature: -edgeCurvatureOf(point),
                      }))
                    }
                  >
                    Inverser la courbe
                  </button>
                ) : null}
                <button type="button" onClick={splitSelectedEdge}>
                  Ajouter un point
                </button>
              </div>
              <p className="planner-panel-note">
                Les points blancs sont toujours déplaçables directement.
              </p>
            </section>
          ) : (
            <section>
              <span className="planner-panel-kicker">Résumé</span>
              <h2>Liste d’achat</h2>
              {buyingList.length === 0 ? (
                <p>
                  Glissez des plantes sur le parterre pour construire la liste.
                </p>
              ) : (
                <ul className="planner-buying-list">
                  {buyingList.map((entry) => (
                    <li key={entry.name}>
                      <span>
                        <strong>{entry.name}</strong>
                        <span className="planner-summary-colors">
                          {[...entry.colors.keys()].map((color) => (
                            <i
                              key={color}
                              title={color}
                              style={{ background: catalogColorToCss(color) }}
                            />
                          ))}
                        </span>
                      </span>
                      <b>× {entry.count}</b>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="secondary-button planner-full-width"
                disabled={buyingList.length === 0}
                onClick={() => setShowBuyingDetails(true)}
              >
                Voir le détail
              </button>
              <dl className="planner-plan-totals">
                <div>
                  <dt>Plantes</dt>
                  <dd>{document.placements.length}</dd>
                </div>
              </dl>
            </section>
          )}
        </aside>
      </div>

      {toast ? (
        <div className="planner-toast" role="status">
          <span>{toast.message}</span>
          {toast.undoable ? (
            <button type="button" onClick={undo}>
              Annuler
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Fermer la notification"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      ) : null}

      {contextMenu ? (
        <div
          className="planner-context-menu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button type="button" onClick={() => duplicatePlant(contextMenu.id)}>
            Dupliquer
          </button>
          <button type="button" onClick={() => deletePlant(contextMenu.id)}>
            Supprimer
          </button>
        </div>
      ) : null}

      {showDimensions ? (
        <div className="planner-modal-backdrop" role="presentation">
          <form
            className="planner-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dimensions-title"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              applyDimensions(
                positiveDimension(String(form.get('width')), widthCm),
                positiveDimension(String(form.get('height')), heightCm),
              );
            }}
          >
            <h2 id="dimensions-title">Dimensions du parterre</h2>
            <p>
              Les plantes restent à leur position. La nouvelle limite peut donc
              créer des avertissements.
            </p>
            <label>
              Largeur (cm)
              <input
                name="width"
                type="number"
                min="20"
                defaultValue={widthCm}
              />
            </label>
            <label>
              Longueur (cm)
              <input
                name="height"
                type="number"
                min="20"
                defaultValue={heightCm}
              />
            </label>
            <div className="planner-modal-actions">
              <button type="button" onClick={() => setShowDimensions(false)}>
                Annuler
              </button>
              <button type="submit" className="primary-button">
                Appliquer
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showLeaveDialog ? (
        <div className="planner-modal-backdrop" role="presentation">
          <section
            className="planner-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
          >
            <h2 id="leave-title">Modifications non enregistrées</h2>
            <p>Voulez-vous enregistrer avant de quitter le plan ?</p>
            <div className="planner-modal-actions stacked">
              <button
                type="button"
                className="primary-button"
                onClick={async () => {
                  if (await save()) {
                    onClose();
                  }
                }}
              >
                Enregistrer et quitter
              </button>
              <button type="button" onClick={onClose}>
                Quitter sans enregistrer
              </button>
              <button type="button" onClick={() => setShowLeaveDialog(false)}>
                Continuer l’édition
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showBuyingDetails ? (
        <div className="planner-modal-backdrop" role="presentation">
          <section
            className="planner-modal planner-buying-details"
            role="dialog"
            aria-modal="true"
            aria-labelledby="buying-title"
          >
            <h2 id="buying-title">Liste d’achat détaillée</h2>
            {buyingList.map((entry) => (
              <div key={entry.name}>
                <h3>
                  {entry.name} <span>× {entry.count}</span>
                </h3>
                <ul>
                  {[...entry.colors].map(([color, count]) => (
                    <li key={color}>
                      <i style={{ background: catalogColorToCss(color) }} />
                      {color} <strong>× {count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="planner-modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => setShowBuyingDetails(false)}
              >
                Fermer
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showWarnings ? (
        <div className="planner-modal-backdrop" role="presentation">
          <section
            className="planner-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="warning-title"
          >
            <h2 id="warning-title">Placements à vérifier</h2>
            <ul className="planner-warning-list">
              {document.placements
                .filter((placement) => warningIds.has(placement.id))
                .map((placement) => (
                  <li key={placement.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlantId(placement.id);
                        setSelectedEdge(null);
                        setShowWarnings(false);
                      }}
                    >
                      <strong>{placement.plantNameSnapshot}</strong>
                      <span>
                        {validation.overlappingIds.has(placement.id)
                          ? 'Chevauchement'
                          : ''}
                        {validation.overlappingIds.has(placement.id) &&
                        validation.outsideIds.has(placement.id)
                          ? ' · '
                          : ''}
                        {validation.outsideIds.has(placement.id)
                          ? 'Hors limites'
                          : ''}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
            <div className="planner-modal-actions">
              <button type="button" onClick={() => setShowWarnings(false)}>
                Fermer
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
