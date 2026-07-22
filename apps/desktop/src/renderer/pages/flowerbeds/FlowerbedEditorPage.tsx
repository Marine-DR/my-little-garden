import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type {
  CatalogPlant,
  FlowerbedDesign,
  FlowerbedPlantPlacementInput,
  FlowerbedSaveInput,
  SelectionDetails,
  SelectionSummary,
} from '@my-little-garden/core';

const DEFAULT_WIDTH_CM = 400;
const DEFAULT_HEIGHT_CM = 250;
const DEFAULT_SPACING_CM = 40;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;
const WHEEL_ZOOM_STEP = 0.1;
const PAN_STEP_PX = 80;
const CORNER_HANDLE_RADIUS_CM = 6;
const ZONE_CORNER_HANDLE_RADIUS_CM = 4;

type EditorMode = 'select' | 'zone' | 'plant';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface ZoneDraft {
  readonly id: string;
  readonly xCm: number;
  readonly yCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly boundaryPoints: readonly Point[];
}

interface PlacementDraft extends FlowerbedPlantPlacementInput {
  readonly id: string;
}

interface DrawingZone {
  readonly start: Point;
  readonly current: Point;
}

interface DraggingPlant {
  readonly id: string;
  readonly offset: Point;
}

interface DraggingZoneCorner {
  readonly zoneId: string;
  readonly cornerIndex: number;
}

interface PanningMap {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly scrollLeft: number;
  readonly scrollTop: number;
}

let draftSequence = 0;

function nextDraftId(prefix: string): string {
  draftSequence += 1;
  return `draft-${prefix}-${draftSequence}`;
}

function positiveDimension(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function adjustedZoom(current: number, change: number): number {
  return (
    Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + change)) * 100) /
    100
  );
}

function circleInsideZone(placement: PlacementDraft, zone: ZoneDraft): boolean {
  return circleInsideBoundary(placement, zone.boundaryPoints);
}

function placementsOverlap(
  first: PlacementDraft,
  second: PlacementDraft,
): boolean {
  const xDistance = first.xCm - second.xCm;
  const yDistance = first.yCm - second.yCm;
  const combinedRadius =
    (first.spacingCmSnapshot + second.spacingCmSnapshot) / 2;
  return (
    xDistance * xDistance + yDistance * yDistance <
    combinedRadius * combinedRadius
  );
}

function rectangularBoundary(widthCm: number, heightCm: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: widthCm, y: 0 },
    { x: widthCm, y: heightCm },
    { x: 0, y: heightCm },
  ];
}

function pointInsidePolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (!currentPoint || !previousPoint) {
      continue;
    }
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + projection * segmentX),
    point.y - (start.y + projection * segmentY),
  );
}

function circleInsideBoundary(
  placement: PlacementDraft,
  boundary: readonly Point[],
): boolean {
  const center = { x: placement.xCm, y: placement.yCm };
  if (!pointInsidePolygon(center, boundary)) {
    return false;
  }
  const radius = placement.spacingCmSnapshot / 2;
  return boundary.every((start, index) => {
    const end = boundary[(index + 1) % boundary.length];
    return end ? distanceToSegment(center, start, end) >= radius : false;
  });
}

function zoneFromPoints(
  start: Point,
  current: Point,
): Omit<ZoneDraft, 'id' | 'boundaryPoints'> {
  return {
    xCm: Math.min(start.x, current.x),
    yCm: Math.min(start.y, current.y),
    widthCm: Math.abs(current.x - start.x),
    heightCm: Math.abs(current.y - start.y),
  };
}

function zoneBoundaryFromRectangle(
  zone: Pick<ZoneDraft, 'xCm' | 'yCm' | 'widthCm' | 'heightCm'>,
): Point[] {
  return [
    { x: zone.xCm, y: zone.yCm },
    { x: zone.xCm + zone.widthCm, y: zone.yCm },
    { x: zone.xCm + zone.widthCm, y: zone.yCm + zone.heightCm },
    { x: zone.xCm, y: zone.yCm + zone.heightCm },
  ];
}

function boundsFromPoints(
  points: readonly Point[],
): Pick<ZoneDraft, 'xCm' | 'yCm' | 'widthCm' | 'heightCm'> {
  const xValues = points.map(({ x }) => x);
  const yValues = points.map(({ y }) => y);
  const minimumX = Math.min(...xValues);
  const minimumY = Math.min(...yValues);
  return {
    xCm: minimumX,
    yCm: minimumY,
    widthCm: Math.max(...xValues) - minimumX,
    heightCm: Math.max(...yValues) - minimumY,
  };
}

function normalizeColorLabel(label: string): string {
  return label.trim().normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

function colorLabelToCss(label: string | null): string {
  if (!label) {
    return '#6fb570';
  }
  const colors: Record<string, string> = {
    blanc: '#ffffff',
    jaune: '#facc15',
    rouge: '#dc2626',
    violet: '#8b5cf6',
    bleu: '#3b82f6',
    rose: '#ec4899',
    orange: '#f97316',
    vert: '#22c55e',
    marron: '#92400e',
    brun: '#92400e',
    noir: '#111827',
  };
  return colors[normalizeColorLabel(label)] ?? '#6fb570';
}

function firstPlantColor(plant: CatalogPlant): string | null {
  return plant.flowerColors[0] ?? plant.leafColors[0] ?? null;
}

export function FlowerbedEditorPage({
  flowerbed,
  onClose,
  onSaved,
}: {
  readonly flowerbed: FlowerbedDesign | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const [name, setName] = useState(flowerbed?.name ?? '');
  const [widthCm, setWidthCm] = useState(
    flowerbed?.widthCm ?? DEFAULT_WIDTH_CM,
  );
  const [heightCm, setHeightCm] = useState(
    flowerbed?.heightCm ?? DEFAULT_HEIGHT_CM,
  );
  const [selectionId, setSelectionId] = useState(flowerbed?.selectionId ?? '');
  const [selections, setSelections] = useState<readonly SelectionSummary[]>([]);
  const [selection, setSelection] = useState<SelectionDetails | null>(null);
  const [zones, setZones] = useState<readonly ZoneDraft[]>(
    () =>
      flowerbed?.zones.map((zone) => ({
        ...zone,
        boundaryPoints: zone.boundaryPoints.map((point) => ({
          x: point.xCm,
          y: point.yCm,
        })),
      })) ?? [],
  );
  const [placements, setPlacements] = useState<readonly PlacementDraft[]>(
    () => flowerbed?.placements.map((placement) => ({ ...placement })) ?? [],
  );
  const [boundaryPoints, setBoundaryPoints] = useState<readonly Point[]>(() =>
    flowerbed
      ? flowerbed.boundaryPoints.map((point) => ({
          x: point.xCm,
          y: point.yCm,
        }))
      : rectangularBoundary(DEFAULT_WIDTH_CM, DEFAULT_HEIGHT_CM),
  );
  const [mode, setMode] = useState<EditorMode>('zone');
  const [selectedPlant, setSelectedPlant] = useState<CatalogPlant | null>(null);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [drawingZone, setDrawingZone] = useState<DrawingZone | null>(null);
  const [draggingPlant, setDraggingPlant] = useState<DraggingPlant | null>(
    null,
  );
  const [draggingCorner, setDraggingCorner] = useState<number | null>(null);
  const [draggingZoneCorner, setDraggingZoneCorner] =
    useState<DraggingZoneCorner | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panningRef = useRef<PanningMap | null>(null);

  useEffect(() => {
    void window.selectionService
      .listSelections()
      .then(setSelections)
      .catch(() => setError('Les sélections n’ont pas pu être chargées.'));
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const handleWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey || event.deltaY === 0) {
        return;
      }
      event.preventDefault();
      setZoom((current) =>
        adjustedZoom(
          current,
          event.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP,
        ),
      );
    };
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
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

  const invalidPlacements = useMemo(() => {
    const invalid = new Set<string>();
    for (const placement of placements) {
      const insideAZone = zones.some((zone) =>
        circleInsideZone(placement, zone),
      );
      if (!insideAZone || !circleInsideBoundary(placement, boundaryPoints)) {
        invalid.add(placement.id);
      }
      for (const other of placements) {
        if (placement.id !== other.id && placementsOverlap(placement, other)) {
          invalid.add(placement.id);
        }
      }
    }
    return invalid;
  }, [boundaryPoints, placements, zones]);

  const eventPoint = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          widthCm,
          ((event.clientX - bounds.left) / bounds.width) * widthCm,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          heightCm,
          ((event.clientY - bounds.top) / bounds.height) * heightCm,
        ),
      ),
    };
  };

  const zoneContainingPoint = (point: Point): string | null =>
    zones.find((zone) => pointInsidePolygon(point, zone.boundaryPoints))?.id ??
    null;

  const handleCanvasPointerDown = (
    event: ReactPointerEvent<SVGSVGElement>,
  ): void => {
    if (event.button !== 0) {
      return;
    }
    const point = eventPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (mode === 'zone') {
      setDrawingZone({ start: point, current: point });
      setSelectedObject(null);
      return;
    }
    if (mode === 'plant' && selectedPlant) {
      const id = nextDraftId('plant');
      setPlacements((current) => [
        ...current,
        {
          id,
          zoneId: zoneContainingPoint(point),
          plantId: selectedPlant.id,
          plantNameSnapshot: selectedPlant.name,
          spacingCmSnapshot: selectedPlant.spacingCm ?? DEFAULT_SPACING_CM,
          colorSnapshot: firstPlantColor(selectedPlant),
          xCm: point.x,
          yCm: point.y,
        },
      ]);
      setSelectedObject(`plant:${id}`);
    } else {
      setSelectedObject(null);
    }
  };

  const handleCanvasPointerMove = (
    event: ReactPointerEvent<SVGSVGElement>,
  ): void => {
    const point = eventPoint(event);
    if (drawingZone) {
      setDrawingZone({ ...drawingZone, current: point });
    }
    if (draggingCorner !== null) {
      setBoundaryPoints((current) =>
        current.map((corner, index) =>
          index === draggingCorner ? point : corner,
        ),
      );
    }
    if (draggingZoneCorner) {
      setZones((current) =>
        current.map((zone) => {
          if (zone.id !== draggingZoneCorner.zoneId) {
            return zone;
          }
          const nextBoundary = zone.boundaryPoints.map((corner, index) =>
            index === draggingZoneCorner.cornerIndex ? point : corner,
          );
          return {
            ...zone,
            ...boundsFromPoints(nextBoundary),
            boundaryPoints: nextBoundary,
          };
        }),
      );
    }
    if (draggingPlant) {
      const next = {
        x: Math.max(0, Math.min(widthCm, point.x - draggingPlant.offset.x)),
        y: Math.max(0, Math.min(heightCm, point.y - draggingPlant.offset.y)),
      };
      setPlacements((current) =>
        current.map((placement) =>
          placement.id === draggingPlant.id
            ? {
                ...placement,
                xCm: next.x,
                yCm: next.y,
                zoneId: zoneContainingPoint(next),
              }
            : placement,
        ),
      );
    }
  };

  const handleCanvasPointerUp = (): void => {
    if (drawingZone) {
      const rectangle = zoneFromPoints(drawingZone.start, drawingZone.current);
      if (rectangle.widthCm >= 10 && rectangle.heightCm >= 10) {
        const id = nextDraftId('zone');
        setZones((current) => [
          ...current,
          {
            id,
            ...rectangle,
            boundaryPoints: zoneBoundaryFromRectangle(rectangle),
          },
        ]);
        setSelectedObject(`zone:${id}`);
      }
      setDrawingZone(null);
    }
    setDraggingPlant(null);
    setDraggingCorner(null);
    setDraggingZoneCorner(null);
  };

  const deleteSelected = (): void => {
    if (!selectedObject) {
      return;
    }
    const [kind, id] = selectedObject.split(':');
    if (!id) {
      return;
    }
    if (kind === 'zone') {
      setZones((current) => current.filter((zone) => zone.id !== id));
      setPlacements((current) =>
        current.map((placement) =>
          placement.zoneId === id ? { ...placement, zoneId: null } : placement,
        ),
      );
    } else {
      setPlacements((current) => current.filter((plant) => plant.id !== id));
    }
    setSelectedObject(null);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea')) {
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        deleteSelected();
      }
      if (event.key === 'Escape') {
        setDrawingZone(null);
        setDraggingPlant(null);
        setSelectedObject(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const save = async (): Promise<void> => {
    if (!name.trim() || !selectionId || zones.length === 0) {
      setError('Indiquez un nom, une sélection et dessinez au moins une zone.');
      return;
    }
    setSaving(true);
    setError(null);
    const input: FlowerbedSaveInput = {
      id: flowerbed?.id,
      name: name.trim(),
      selectionId,
      widthCm,
      heightCm,
      boundaryPoints: boundaryPoints.map((point) => ({
        xCm: point.x,
        yCm: point.y,
      })),
      zones: zones.map((zone) => ({
        id: zone.id,
        xCm: zone.xCm,
        yCm: zone.yCm,
        widthCm: zone.widthCm,
        heightCm: zone.heightCm,
        boundaryPoints: zone.boundaryPoints.map((point) => ({
          xCm: point.x,
          yCm: point.y,
        })),
      })),
      placements,
    };
    try {
      await window.flowerbedService.saveFlowerbed(input);
      onSaved();
    } catch {
      setError('Le parterre n’a pas pu être enregistré.');
    } finally {
      setSaving(false);
    }
  };

  const drawingRectangle = drawingZone
    ? zoneFromPoints(drawingZone.start, drawingZone.current)
    : null;
  const boundaryPolygonPoints = boundaryPoints
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  const startPanning = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    panningRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPanning(true);
  };

  const continuePanning = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pan = panningRef.current;
    if (!pan || pan.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.currentTarget.scrollLeft =
      pan.scrollLeft - (event.clientX - pan.startX);
    event.currentTarget.scrollTop =
      pan.scrollTop - (event.clientY - pan.startY);
  };

  const stopPanning = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (panningRef.current?.pointerId !== event.pointerId) {
      return;
    }
    panningRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    setPanning(false);
  };

  const panMap = (horizontal: number, vertical: number): void => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    viewport.scrollLeft += horizontal;
    viewport.scrollTop += vertical;
  };

  return (
    <section className="flowerbed-editor">
      <header className="flowerbed-editor-heading">
        <div>
          <h1>{flowerbed ? 'Modifier le parterre' : 'Nouveau parterre'}</h1>
          <p>Vue du dessus · toutes les dimensions sont en centimètres</p>
        </div>
        <div className="flowerbed-editor-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </header>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      <div className="flowerbed-editor-grid">
        <aside
          className="flowerbed-panel flowerbed-tools"
          aria-label="Outils du parterre"
        >
          <label>
            Nom
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Parterre terrasse"
            />
          </label>
          <label>
            Sélection de plantes
            <select
              value={selectionId}
              onChange={(event) => {
                setSelectionId(event.target.value);
                setSelection(null);
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
          <div className="flowerbed-dimensions">
            <label>
              Largeur
              <input
                type="number"
                min="20"
                value={widthCm}
                onChange={(event) =>
                  setWidthCm(positiveDimension(event.target.value, widthCm))
                }
              />
            </label>
            <label>
              Profondeur
              <input
                type="number"
                min="20"
                value={heightCm}
                onChange={(event) =>
                  setHeightCm(positiveDimension(event.target.value, heightCm))
                }
              />
            </label>
          </div>
          <fieldset>
            <legend>Outil</legend>
            <button
              type="button"
              className={mode === 'select' ? 'active' : ''}
              onClick={() => setMode('select')}
            >
              Déplacer
            </button>
            <button
              type="button"
              className={mode === 'zone' ? 'active' : ''}
              onClick={() => setMode('zone')}
            >
              Dessiner une zone
            </button>
            <button
              type="button"
              className={mode === 'plant' ? 'active' : ''}
              disabled={!selectedPlant}
              onClick={() => setMode('plant')}
            >
              Placer la plante
            </button>
          </fieldset>
          <button
            type="button"
            className="delete-button"
            disabled={!selectedObject}
            onClick={deleteSelected}
          >
            Supprimer l’élément
          </button>
          <div className="flowerbed-legend">
            <p>
              <span className="legend-zone" /> Zone de plantation
            </p>
            <p>
              <span className="legend-warning" /> Chevauchement ou hors zone
            </p>
          </div>
        </aside>

        <div className="flowerbed-canvas-wrap">
          <div className="flowerbed-zoom-controls" aria-label="Zoom du plan">
            <span className="flowerbed-pan-help">
              Maintenez la molette et glissez pour déplacer le plan
            </span>
            <button
              type="button"
              aria-label="Zoom arrière"
              disabled={zoom <= MIN_ZOOM}
              onClick={() =>
                setZoom((current) => adjustedZoom(current, -ZOOM_STEP))
              }
            >
              −
            </button>
            <button
              type="button"
              className="flowerbed-zoom-value"
              aria-label="Réinitialiser le zoom"
              onClick={() => setZoom(1)}
            >
              {Math.round(zoom * 100)} %
            </button>
            <button
              type="button"
              aria-label="Zoom avant"
              disabled={zoom >= MAX_ZOOM}
              onClick={() =>
                setZoom((current) => adjustedZoom(current, ZOOM_STEP))
              }
            >
              +
            </button>
          </div>
          <div className="flowerbed-canvas-viewport-shell">
            <div
              ref={viewportRef}
              className={`flowerbed-canvas-viewport ${panning ? 'is-panning' : ''}`}
              aria-label="Zone de dessin"
              onPointerDown={startPanning}
              onPointerMove={continuePanning}
              onPointerUp={stopPanning}
              onPointerCancel={stopPanning}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                }
              }}
            >
              <div
                className="flowerbed-canvas-stage"
                style={{ width: `${zoom * 100}%` }}
              >
                <svg
                  ref={svgRef}
                  className={`flowerbed-canvas mode-${mode}`}
                  viewBox={`0 0 ${widthCm} ${heightCm}`}
                  aria-label={`Plan du parterre ${widthCm} par ${heightCm} centimètres`}
                  role="img"
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  onContextMenu={(event) => {
                    if (selectedPlant) {
                      event.preventDefault();
                      setMode('select');
                      setSelectedPlant(null);
                    }
                  }}
                >
                  <defs>
                    <pattern
                      id="flowerbed-grid"
                      width="20"
                      height="20"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 20 0 L 0 0 0 20"
                        fill="none"
                        stroke="#dfe8dc"
                        strokeWidth="1"
                      />
                    </pattern>
                    <clipPath id="flowerbed-boundary-clip">
                      <polygon points={boundaryPolygonPoints} />
                    </clipPath>
                  </defs>
                  <polygon
                    className="flowerbed-boundary"
                    points={boundaryPolygonPoints}
                  />
                  <rect
                    x="0"
                    y="0"
                    width={widthCm}
                    height={heightCm}
                    fill="url(#flowerbed-grid)"
                    clipPath="url(#flowerbed-boundary-clip)"
                    pointerEvents="none"
                  />
                  {zones.map((zone, index) => (
                    <g key={zone.id}>
                      <polygon
                        className={`planting-zone ${selectedObject === `zone:${zone.id}` ? 'selected' : ''}`}
                        points={zone.boundaryPoints
                          .map((point) => `${point.x},${point.y}`)
                          .join(' ')}
                        role="button"
                        aria-label={`Sélectionner la zone ${index + 1}`}
                        onPointerDown={(event) => {
                          if (event.button !== 0 || mode !== 'select') {
                            return;
                          }
                          event.stopPropagation();
                          setSelectedObject(`zone:${zone.id}`);
                        }}
                        onClick={(event) => {
                          if (mode !== 'select') {
                            return;
                          }
                          event.stopPropagation();
                          setSelectedObject(`zone:${zone.id}`);
                        }}
                      />
                      <text
                        className="zone-label"
                        x={zone.xCm + 6}
                        y={zone.yCm + 16}
                      >
                        Zone {index + 1}
                      </text>
                      {selectedObject === `zone:${zone.id}`
                        ? zone.boundaryPoints.map((point, cornerIndex) => (
                            <circle
                              key={`${zone.id}-corner-${cornerIndex}`}
                              className={`planting-zone-corner-handle ${draggingZoneCorner?.zoneId === zone.id && draggingZoneCorner.cornerIndex === cornerIndex ? 'dragging' : ''}`}
                              cx={Math.max(
                                ZONE_CORNER_HANDLE_RADIUS_CM,
                                Math.min(
                                  widthCm - ZONE_CORNER_HANDLE_RADIUS_CM,
                                  point.x,
                                ),
                              )}
                              cy={Math.max(
                                ZONE_CORNER_HANDLE_RADIUS_CM,
                                Math.min(
                                  heightCm - ZONE_CORNER_HANDLE_RADIUS_CM,
                                  point.y,
                                ),
                              )}
                              r={ZONE_CORNER_HANDLE_RADIUS_CM}
                              role="button"
                              aria-label={`Déplacer le coin ${cornerIndex + 1} de la zone ${index + 1}`}
                              onPointerDown={(event) => {
                                if (event.button !== 0) {
                                  return;
                                }
                                event.preventDefault();
                                event.stopPropagation();
                                event.currentTarget.ownerSVGElement?.setPointerCapture?.(
                                  event.pointerId,
                                );
                                setMode('select');
                                setSelectedPlant(null);
                                setDraggingZoneCorner({
                                  zoneId: zone.id,
                                  cornerIndex,
                                });
                              }}
                            >
                              <title>
                                Zone {index + 1}, coin {cornerIndex + 1}
                              </title>
                            </circle>
                          ))
                        : null}
                    </g>
                  ))}
                  {drawingRectangle ? (
                    <rect
                      className="planting-zone drawing"
                      x={drawingRectangle.xCm}
                      y={drawingRectangle.yCm}
                      width={drawingRectangle.widthCm}
                      height={drawingRectangle.heightCm}
                    />
                  ) : null}
                  {placements.map((placement, index) => {
                    const invalid = invalidPlacements.has(placement.id);
                    return (
                      <g
                        key={placement.id}
                        className={`plant-placement ${invalid ? 'invalid' : ''} ${selectedObject === `plant:${placement.id}` ? 'selected' : ''}`}
                        onPointerDown={(event) => {
                          if (event.button !== 0 || mode !== 'select') {
                            return;
                          }
                          event.stopPropagation();
                          const bounds =
                            svgRef.current?.getBoundingClientRect();
                          if (!bounds) {
                            return;
                          }
                          const point = {
                            x:
                              ((event.clientX - bounds.left) / bounds.width) *
                              widthCm,
                            y:
                              ((event.clientY - bounds.top) / bounds.height) *
                              heightCm,
                          };
                          setSelectedObject(`plant:${placement.id}`);
                          setDraggingPlant({
                            id: placement.id,
                            offset: {
                              x: point.x - placement.xCm,
                              y: point.y - placement.yCm,
                            },
                          });
                        }}
                      >
                        <circle
                          cx={placement.xCm}
                          cy={placement.yCm}
                          r={placement.spacingCmSnapshot / 2}
                          style={{
                            fill: colorLabelToCss(placement.colorSnapshot),
                          }}
                        />
                        <text
                          x={placement.xCm}
                          y={placement.yCm}
                          dominantBaseline="middle"
                        >
                          {index + 1}
                        </text>
                        <title>
                          {placement.plantNameSnapshot} · diamètre{' '}
                          {placement.spacingCmSnapshot} cm
                          {invalid ? ' · placement à vérifier' : ''}
                        </title>
                      </g>
                    );
                  })}
                  {boundaryPoints.map((point, index) => (
                    <circle
                      key={`corner-${index}`}
                      className={`flowerbed-corner-handle ${draggingCorner === index ? 'dragging' : ''}`}
                      cx={Math.max(
                        CORNER_HANDLE_RADIUS_CM,
                        Math.min(widthCm - CORNER_HANDLE_RADIUS_CM, point.x),
                      )}
                      cy={Math.max(
                        CORNER_HANDLE_RADIUS_CM,
                        Math.min(heightCm - CORNER_HANDLE_RADIUS_CM, point.y),
                      )}
                      r={CORNER_HANDLE_RADIUS_CM}
                      role="button"
                      aria-label={`Déplacer le coin ${index + 1}`}
                      onPointerDown={(event) => {
                        if (event.button !== 0) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        event.currentTarget.ownerSVGElement?.setPointerCapture?.(
                          event.pointerId,
                        );
                        setMode('select');
                        setSelectedPlant(null);
                        setSelectedObject(null);
                        setDraggingCorner(index);
                      }}
                    >
                      <title>
                        Coin {index + 1} · glissez pour modifier la forme
                      </title>
                    </circle>
                  ))}
                </svg>
              </div>
            </div>
            <div className="flowerbed-pan-pad" aria-label="Déplacer la vue">
              <button
                type="button"
                className="pan-up"
                aria-label="Déplacer la vue vers le haut"
                onClick={() => panMap(0, -PAN_STEP_PX)}
              >
                ↑
              </button>
              <button
                type="button"
                className="pan-left"
                aria-label="Déplacer la vue vers la gauche"
                onClick={() => panMap(-PAN_STEP_PX, 0)}
              >
                ←
              </button>
              <span className="pan-center" aria-hidden="true" />
              <button
                type="button"
                className="pan-right"
                aria-label="Déplacer la vue vers la droite"
                onClick={() => panMap(PAN_STEP_PX, 0)}
              >
                →
              </button>
              <button
                type="button"
                className="pan-down"
                aria-label="Déplacer la vue vers le bas"
                onClick={() => panMap(0, PAN_STEP_PX)}
              >
                ↓
              </button>
            </div>
          </div>
          <p className="flowerbed-canvas-status" role="status">
            {invalidPlacements.size > 0
              ? `${invalidPlacements.size} plante${invalidPlacements.size === 1 ? '' : 's'} à repositionner`
              : `${placements.length} plante${placements.length === 1 ? '' : 's'} placée${placements.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <aside
          className="flowerbed-panel plant-palette"
          aria-label="Plantes disponibles"
        >
          <h2>Plantes</h2>
          {!selectionId ? <p>Choisissez une sélection.</p> : null}
          {selectionId && selection?.plants.length === 0 ? (
            <p>Cette sélection est vide.</p>
          ) : null}
          {selection?.plants.map((plant) => (
            <button
              key={plant.id}
              type="button"
              className={selectedPlant?.id === plant.id ? 'selected' : ''}
              onClick={() => {
                setSelectedPlant(plant);
                setMode('plant');
              }}
            >
              <span
                className="plant-palette-circle"
                style={{ background: colorLabelToCss(firstPlantColor(plant)) }}
              />
              <span>
                <strong>{plant.name}</strong>
                <small>
                  {plant.spacingCm
                    ? `Ø ${plant.spacingCm} cm`
                    : `Ø ${DEFAULT_SPACING_CM} cm estimé`}
                </small>
              </span>
            </button>
          ))}
          {selectedPlant ? (
            <p className="plant-palette-help">
              Cliquez dans le plan pour ajouter autant d’exemplaires que
              nécessaire. Clic droit pour désélectionner la plante.
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
