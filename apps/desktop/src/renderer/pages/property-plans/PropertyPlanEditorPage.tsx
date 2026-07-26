import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type {
  BoundaryEdgeKind,
  CatalogPlant,
  PropertyPlanDesign,
  PropertyPlanPlantPlacementInput,
  PropertyPlanSaveInput,
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
const FLOWERBED_CORNER_HANDLE_RADIUS_CM = 4;
const CURVE_SAMPLE_COUNT = 24;

const defaultEdgeCurvature: Record<
  Exclude<BoundaryEdgeKind, 'line'>,
  number
> = {
  'circular-arc': 0.2,
  'elliptical-arc': 0.3,
  bezier: 0.22,
};

type EditorMode = 'select' | 'flowerbed' | 'plant';

interface Point {
  readonly x: number;
  readonly y: number;
  readonly edgeKind?: BoundaryEdgeKind;
  readonly edgeCurvature?: number;
}

interface FlowerbedDraft {
  readonly id: string;
  readonly xCm: number;
  readonly yCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly boundaryPoints: readonly Point[];
}

interface PlacementDraft extends PropertyPlanPlantPlacementInput {
  readonly id: string;
}

interface DrawingFlowerbed {
  readonly start: Point;
  readonly current: Point;
}

interface DraggingPlant {
  readonly id: string;
  readonly offset: Point;
}

interface DraggingFlowerbedCorner {
  readonly flowerbedId: string;
  readonly cornerIndex: number;
}

type EdgeOwner =
  | { readonly kind: 'property' }
  | {
      readonly kind: 'flowerbed';
      readonly flowerbedId: string;
      readonly flowerbedIndex: number;
    };

interface SelectedEdge {
  readonly owner: EdgeOwner;
  readonly edgeIndex: number;
  readonly ratio: number;
  readonly anchor: Point;
}

interface DraggingEdgeMenu {
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startOffset: Point;
}

interface DraggingEdgeControl {
  readonly pointerId: number;
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

function circleInsideFlowerbed(
  placement: PlacementDraft,
  flowerbed: FlowerbedDraft,
): boolean {
  return circleInsideBoundary(placement, flowerbed.boundaryPoints);
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
  return segmentProjection(point, start, end).distance;
}

function segmentProjection(
  point: Point,
  start: Point,
  end: Point,
): { readonly ratio: number; readonly distance: number } {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) {
    return {
      ratio: 0,
      distance: Math.hypot(point.x - start.x, point.y - start.y),
    };
  }
  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
        lengthSquared,
    ),
  );
  return {
    ratio,
    distance: Math.hypot(
      point.x - (start.x + ratio * segmentX),
      point.y - (start.y + ratio * segmentY),
    ),
  };
}

function edgeKindOf(point: Point): BoundaryEdgeKind {
  return point.edgeKind ?? 'line';
}

function edgeCurvatureOf(point: Point): number {
  const kind = edgeKindOf(point);
  return kind === 'line'
    ? 0
    : (point.edgeCurvature ?? defaultEdgeCurvature[kind]);
}

function edgeMidpoint(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function edgePerpendicular(start: Point, end: Point): Point {
  const xDistance = end.x - start.x;
  const yDistance = end.y - start.y;
  const length = Math.hypot(xDistance, yDistance);
  return length === 0
    ? { x: 0, y: 0 }
    : { x: -yDistance / length, y: xDistance / length };
}

function circularArcCenter(start: Point, end: Point): Point {
  const midpoint = edgeMidpoint(start, end);
  const perpendicular = edgePerpendicular(start, end);
  const chordLength = Math.hypot(end.x - start.x, end.y - start.y);
  const sagitta = edgeCurvatureOf(start) * chordLength;
  if (chordLength === 0 || Math.abs(sagitta) < 0.001) {
    return midpoint;
  }
  const halfChord = chordLength / 2;
  const centerOffset =
    (sagitta * sagitta - halfChord * halfChord) / (2 * sagitta);
  return {
    x: midpoint.x + perpendicular.x * centerOffset,
    y: midpoint.y + perpendicular.y * centerOffset,
  };
}

function edgeControlPoint(start: Point, end: Point): Point {
  const kind = edgeKindOf(start);
  if (kind === 'circular-arc') {
    return circularArcCenter(start, end);
  }
  const midpoint = edgeMidpoint(start, end);
  if (kind === 'elliptical-arc') {
    return edgePointAt(start, end, 0.5);
  }
  if (kind === 'bezier') {
    const perpendicular = edgePerpendicular(start, end);
    const chordLength = Math.hypot(end.x - start.x, end.y - start.y);
    const controlOffset = 2 * edgeCurvatureOf(start) * chordLength;
    return {
      x: midpoint.x + perpendicular.x * controlOffset,
      y: midpoint.y + perpendicular.y * controlOffset,
    };
  }
  return midpoint;
}

function curvatureFromControlPoint(
  kind: Exclude<BoundaryEdgeKind, 'line'>,
  start: Point,
  end: Point,
  control: Point,
): number {
  const midpoint = edgeMidpoint(start, end);
  const perpendicular = edgePerpendicular(start, end);
  const chordLength = Math.hypot(end.x - start.x, end.y - start.y);
  if (chordLength === 0) {
    return edgeCurvatureOf(start);
  }
  const projectedOffset =
    (control.x - midpoint.x) * perpendicular.x +
    (control.y - midpoint.y) * perpendicular.y;
  let curvature: number;
  if (kind === 'circular-arc') {
    const halfChord = chordLength / 2;
    const sagitta =
      projectedOffset === 0
        ? Math.sign(edgeCurvatureOf(start) || 1) * halfChord
        : projectedOffset -
          Math.sign(projectedOffset) * Math.hypot(projectedOffset, halfChord);
    curvature = sagitta / chordLength;
  } else {
    curvature = projectedOffset / chordLength / (kind === 'bezier' ? 2 : 1);
  }
  const sign = Math.sign(curvature || edgeCurvatureOf(start) || 1);
  return sign * Math.min(0.5, Math.max(0.05, Math.abs(curvature)));
}

function edgePointAt(start: Point, end: Point, ratio: number): Point {
  const xDistance = end.x - start.x;
  const yDistance = end.y - start.y;
  const chordLength = Math.hypot(xDistance, yDistance);
  const linear = {
    x: start.x + xDistance * ratio,
    y: start.y + yDistance * ratio,
  };
  const kind = edgeKindOf(start);
  const curvature = edgeCurvatureOf(start);
  if (kind === 'line' || chordLength === 0 || Math.abs(curvature) < 0.001) {
    return linear;
  }

  const perpendicularX = -yDistance / chordLength;
  const perpendicularY = xDistance / chordLength;
  const sagitta = curvature * chordLength;
  const offset = (() => {
    if (kind === 'bezier') {
      return 4 * sagitta * ratio * (1 - ratio);
    }
    const halfChord = chordLength / 2;
    const localX = -halfChord + chordLength * ratio;
    if (kind === 'elliptical-arc') {
      return (
        Math.sign(sagitta) *
        Math.abs(sagitta) *
        Math.sqrt(Math.max(0, 1 - (localX * localX) / (halfChord * halfChord)))
      );
    }
    const centerOffset =
      (sagitta * sagitta - halfChord * halfChord) / (2 * sagitta);
    const radius = Math.hypot(halfChord, centerOffset);
    return (
      centerOffset +
      Math.sign(sagitta) *
        Math.sqrt(Math.max(0, radius * radius - localX * localX))
    );
  })();
  return {
    x: linear.x + perpendicularX * offset,
    y: linear.y + perpendicularY * offset,
  };
}

function sampleEdge(
  start: Point,
  end: Point,
  sampleCount = CURVE_SAMPLE_COUNT,
): readonly Point[] {
  return Array.from({ length: sampleCount + 1 }, (_, index) =>
    edgePointAt(start, end, index / sampleCount),
  );
}

function closestEdgeRatio(point: Point, start: Point, end: Point): number {
  const samples = sampleEdge(start, end, CURVE_SAMPLE_COUNT * 2);
  let closest = { ratio: 0, distance: Number.POSITIVE_INFINITY };
  for (let index = 0; index < samples.length - 1; index += 1) {
    const segmentStart = samples[index];
    const segmentEnd = samples[index + 1];
    if (!segmentStart || !segmentEnd) {
      continue;
    }
    const projection = segmentProjection(point, segmentStart, segmentEnd);
    if (projection.distance < closest.distance) {
      closest = {
        distance: projection.distance,
        ratio: (index + projection.ratio) / (samples.length - 1),
      };
    }
  }
  return closest.ratio;
}

function sampleBoundary(points: readonly Point[]): readonly Point[] {
  return points.flatMap((start, index) => {
    const end = points[(index + 1) % points.length];
    return end ? sampleEdge(start, end).slice(0, -1) : [];
  });
}

function edgePathData(start: Point, end: Point): string {
  return sampleEdge(start, end)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function boundaryPathData(points: readonly Point[]): string {
  const samples = sampleBoundary(points);
  if (samples.length === 0) {
    return '';
  }
  return `${samples
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')} Z`;
}

function insertPointAfter(
  points: readonly Point[],
  edgeIndex: number,
  point: Point,
): readonly Point[] {
  const edgeStart = points[edgeIndex];
  const insertedPoint = edgeStart
    ? {
        ...point,
        edgeKind: edgeStart.edgeKind,
        edgeCurvature: edgeStart.edgeCurvature,
      }
    : point;
  return [
    ...points.slice(0, edgeIndex + 1),
    insertedPoint,
    ...points.slice(edgeIndex + 1),
  ];
}

function circleInsideBoundary(
  placement: PlacementDraft,
  boundary: readonly Point[],
): boolean {
  const center = { x: placement.xCm, y: placement.yCm };
  const sampledBoundary = sampleBoundary(boundary);
  if (!pointInsidePolygon(center, sampledBoundary)) {
    return false;
  }
  const radius = placement.spacingCmSnapshot / 2;
  return sampledBoundary.every((start, index) => {
    const end = sampledBoundary[(index + 1) % sampledBoundary.length];
    return end ? distanceToSegment(center, start, end) >= radius : false;
  });
}

function flowerbedFromPoints(
  start: Point,
  current: Point,
): Omit<FlowerbedDraft, 'id' | 'boundaryPoints'> {
  return {
    xCm: Math.min(start.x, current.x),
    yCm: Math.min(start.y, current.y),
    widthCm: Math.abs(current.x - start.x),
    heightCm: Math.abs(current.y - start.y),
  };
}

function flowerbedBoundaryFromRectangle(
  flowerbed: Pick<FlowerbedDraft, 'xCm' | 'yCm' | 'widthCm' | 'heightCm'>,
): Point[] {
  return [
    { x: flowerbed.xCm, y: flowerbed.yCm },
    { x: flowerbed.xCm + flowerbed.widthCm, y: flowerbed.yCm },
    {
      x: flowerbed.xCm + flowerbed.widthCm,
      y: flowerbed.yCm + flowerbed.heightCm,
    },
    { x: flowerbed.xCm, y: flowerbed.yCm + flowerbed.heightCm },
  ];
}

function boundsFromPoints(
  points: readonly Point[],
): Pick<FlowerbedDraft, 'xCm' | 'yCm' | 'widthCm' | 'heightCm'> {
  const sampledPoints = sampleBoundary(points);
  const xValues = sampledPoints.map(({ x }) => x);
  const yValues = sampledPoints.map(({ y }) => y);
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

export function PropertyPlanEditorPage({
  propertyPlan,
  onClose,
  onSaved,
}: {
  readonly propertyPlan: PropertyPlanDesign | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const [name, setName] = useState(propertyPlan?.name ?? '');
  const [widthCm, setWidthCm] = useState(
    propertyPlan?.widthCm ?? DEFAULT_WIDTH_CM,
  );
  const [heightCm, setHeightCm] = useState(
    propertyPlan?.heightCm ?? DEFAULT_HEIGHT_CM,
  );
  const [selectionId, setSelectionId] = useState(
    propertyPlan?.selectionId ?? '',
  );
  const [selections, setSelections] = useState<readonly SelectionSummary[]>([]);
  const [selection, setSelection] = useState<SelectionDetails | null>(null);
  const [flowerbeds, setFlowerbeds] = useState<readonly FlowerbedDraft[]>(
    () =>
      propertyPlan?.flowerbeds.map((flowerbed) => ({
        ...flowerbed,
        boundaryPoints: flowerbed.boundaryPoints.map((point) => ({
          x: point.xCm,
          y: point.yCm,
          edgeKind: point.edgeKind,
          edgeCurvature: point.edgeCurvature,
        })),
      })) ?? [],
  );
  const [placements, setPlacements] = useState<readonly PlacementDraft[]>(
    () => propertyPlan?.placements.map((placement) => ({ ...placement })) ?? [],
  );
  const [boundaryPoints, setBoundaryPoints] = useState<readonly Point[]>(() =>
    propertyPlan
      ? propertyPlan.propertyBoundaryPoints.map((point) => ({
          x: point.xCm,
          y: point.yCm,
          edgeKind: point.edgeKind,
          edgeCurvature: point.edgeCurvature,
        }))
      : rectangularBoundary(DEFAULT_WIDTH_CM, DEFAULT_HEIGHT_CM),
  );
  const [mode, setMode] = useState<EditorMode>('flowerbed');
  const [selectedPlant, setSelectedPlant] = useState<CatalogPlant | null>(null);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [drawingFlowerbed, setDrawingFlowerbed] =
    useState<DrawingFlowerbed | null>(null);
  const [draggingPlant, setDraggingPlant] = useState<DraggingPlant | null>(
    null,
  );
  const [draggingCorner, setDraggingCorner] = useState<number | null>(null);
  const [draggingFlowerbedCorner, setDraggingFlowerbedCorner] =
    useState<DraggingFlowerbedCorner | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null);
  const [edgeMenuOffset, setEdgeMenuOffset] = useState<Point>({ x: 0, y: 0 });
  const [draggingEdgeMenu, setDraggingEdgeMenu] =
    useState<DraggingEdgeMenu | null>(null);
  const [draggingEdgeControl, setDraggingEdgeControl] =
    useState<DraggingEdgeControl | null>(null);
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
      const insideAParterre = flowerbeds.some((flowerbed) =>
        circleInsideFlowerbed(placement, flowerbed),
      );
      if (
        !insideAParterre ||
        !circleInsideBoundary(placement, boundaryPoints)
      ) {
        invalid.add(placement.id);
      }
      for (const other of placements) {
        if (placement.id !== other.id && placementsOverlap(placement, other)) {
          invalid.add(placement.id);
        }
      }
    }
    return invalid;
  }, [boundaryPoints, placements, flowerbeds]);

  const unboundedPointFromClientPosition = (
    clientX: number,
    clientY: number,
  ): Point => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: ((clientX - bounds.left) / bounds.width) * widthCm,
      y: ((clientY - bounds.top) / bounds.height) * heightCm,
    };
  };

  const pointFromClientPosition = (clientX: number, clientY: number): Point => {
    const point = unboundedPointFromClientPosition(clientX, clientY);
    return {
      x: Math.max(0, Math.min(widthCm, point.x)),
      y: Math.max(0, Math.min(heightCm, point.y)),
    };
  };

  const eventPoint = (event: ReactPointerEvent<SVGSVGElement>): Point =>
    pointFromClientPosition(event.clientX, event.clientY);

  const selectedFlowerbedId =
    selectedEdge?.owner.kind === 'flowerbed'
      ? selectedEdge.owner.flowerbedId
      : null;
  const selectedEdgeBoundary = selectedEdge
    ? selectedEdge.owner.kind === 'property'
      ? boundaryPoints
      : flowerbeds.find((flowerbed) => flowerbed.id === selectedFlowerbedId)
          ?.boundaryPoints
    : undefined;
  const selectedEdgeStart =
    selectedEdgeBoundary?.[selectedEdge?.edgeIndex ?? -1];
  const selectedEdgeEnd =
    selectedEdge && selectedEdgeBoundary
      ? selectedEdgeBoundary[
          (selectedEdge.edgeIndex + 1) % selectedEdgeBoundary.length
        ]
      : undefined;
  const selectedEdgeControl =
    selectedEdgeStart &&
    selectedEdgeEnd &&
    edgeKindOf(selectedEdgeStart) !== 'line'
      ? edgeControlPoint(selectedEdgeStart, selectedEdgeEnd)
      : null;

  const selectEdge = (
    owner: EdgeOwner,
    edgeIndex: number,
    points: readonly Point[],
    event: ReactMouseEvent<SVGPathElement>,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    const start = points[edgeIndex];
    const end = points[(edgeIndex + 1) % points.length];
    if (!start || !end) {
      return;
    }
    setMode('select');
    setSelectedPlant(null);
    setSelectedObject(
      owner.kind === 'flowerbed' ? `flowerbed:${owner.flowerbedId}` : null,
    );
    setEdgeMenuOffset({ x: 0, y: 0 });
    setDraggingEdgeMenu(null);
    setDraggingEdgeControl(null);
    const ratio = closestEdgeRatio(
      pointFromClientPosition(event.clientX, event.clientY),
      start,
      end,
    );
    setSelectedEdge({
      owner,
      edgeIndex,
      ratio,
      anchor: edgePointAt(start, end, ratio),
    });
  };

  const splitSelectedEdge = (): void => {
    if (!selectedEdge) {
      return;
    }
    if (selectedEdge.owner.kind === 'property') {
      setBoundaryPoints((current) => {
        const start = current[selectedEdge.edgeIndex];
        const end = current[(selectedEdge.edgeIndex + 1) % current.length];
        return start && end
          ? insertPointAfter(
              current,
              selectedEdge.edgeIndex,
              edgePointAt(start, end, selectedEdge.ratio),
            )
          : current;
      });
    } else {
      const flowerbedId = selectedEdge.owner.flowerbedId;
      setFlowerbeds((current) =>
        current.map((flowerbed) => {
          if (flowerbed.id !== flowerbedId) {
            return flowerbed;
          }
          const start = flowerbed.boundaryPoints[selectedEdge.edgeIndex];
          const end =
            flowerbed.boundaryPoints[
              (selectedEdge.edgeIndex + 1) % flowerbed.boundaryPoints.length
            ];
          if (!start || !end) {
            return flowerbed;
          }
          const nextBoundary = insertPointAfter(
            flowerbed.boundaryPoints,
            selectedEdge.edgeIndex,
            edgePointAt(start, end, selectedEdge.ratio),
          );
          return {
            ...flowerbed,
            ...boundsFromPoints(nextBoundary),
            boundaryPoints: nextBoundary,
          };
        }),
      );
    }
    setDraggingEdgeMenu(null);
    setSelectedEdge(null);
  };

  const updateSelectedEdge = (
    edgeKind: BoundaryEdgeKind,
    edgeCurvature?: number,
  ): void => {
    if (!selectedEdge || !selectedEdgeStart) {
      return;
    }
    const currentKind = edgeKindOf(selectedEdgeStart);
    const currentCurvature = edgeCurvatureOf(selectedEdgeStart);
    const curvature =
      edgeKind === 'line'
        ? 0
        : (edgeCurvature ??
          (currentKind === 'line'
            ? defaultEdgeCurvature[edgeKind]
            : Math.sign(currentCurvature || 1) *
              (Math.abs(currentCurvature) || defaultEdgeCurvature[edgeKind])));
    const updateBoundary = (points: readonly Point[]): readonly Point[] =>
      points.map((point, index) =>
        index === selectedEdge.edgeIndex
          ? {
              ...point,
              edgeKind,
              edgeCurvature: curvature,
            }
          : point,
      );

    if (selectedEdge.owner.kind === 'property') {
      setBoundaryPoints(updateBoundary);
      return;
    }
    const flowerbedId = selectedEdge.owner.flowerbedId;
    setFlowerbeds((current) =>
      current.map((flowerbed) => {
        if (flowerbed.id !== flowerbedId) {
          return flowerbed;
        }
        const nextBoundary = updateBoundary(flowerbed.boundaryPoints);
        return {
          ...flowerbed,
          ...boundsFromPoints(nextBoundary),
          boundaryPoints: nextBoundary,
        };
      }),
    );
  };

  const flowerbedContainingPoint = (point: Point): string | null =>
    flowerbeds.find((flowerbed) =>
      pointInsidePolygon(point, sampleBoundary(flowerbed.boundaryPoints)),
    )?.id ?? null;

  const handleCanvasPointerDown = (
    event: ReactPointerEvent<SVGSVGElement>,
  ): void => {
    if (event.button !== 0) {
      return;
    }
    const point = eventPoint(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedEdge(null);
    if (mode === 'flowerbed') {
      setDrawingFlowerbed({ start: point, current: point });
      setSelectedObject(null);
      return;
    }
    if (mode === 'plant' && selectedPlant) {
      const id = nextDraftId('plant');
      setPlacements((current) => [
        ...current,
        {
          id,
          flowerbedId: flowerbedContainingPoint(point),
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
    const point = draggingEdgeControl
      ? unboundedPointFromClientPosition(event.clientX, event.clientY)
      : eventPoint(event);
    if (
      draggingEdgeControl &&
      draggingEdgeControl.pointerId === event.pointerId &&
      selectedEdgeStart &&
      selectedEdgeEnd
    ) {
      const kind = edgeKindOf(selectedEdgeStart);
      if (kind !== 'line') {
        updateSelectedEdge(
          kind,
          curvatureFromControlPoint(
            kind,
            selectedEdgeStart,
            selectedEdgeEnd,
            point,
          ),
        );
      }
    }
    if (drawingFlowerbed) {
      setDrawingFlowerbed({ ...drawingFlowerbed, current: point });
    }
    if (draggingCorner !== null) {
      setSelectedEdge(null);
      setBoundaryPoints((current) =>
        current.map((corner, index) =>
          index === draggingCorner ? { ...corner, ...point } : corner,
        ),
      );
    }
    if (draggingFlowerbedCorner) {
      setSelectedEdge(null);
      setFlowerbeds((current) =>
        current.map((flowerbed) => {
          if (flowerbed.id !== draggingFlowerbedCorner.flowerbedId) {
            return flowerbed;
          }
          const nextBoundary = flowerbed.boundaryPoints.map((corner, index) =>
            index === draggingFlowerbedCorner.cornerIndex
              ? { ...corner, ...point }
              : corner,
          );
          return {
            ...flowerbed,
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
                flowerbedId: flowerbedContainingPoint(next),
              }
            : placement,
        ),
      );
    }
  };

  const handleCanvasPointerUp = (): void => {
    if (drawingFlowerbed) {
      const rectangle = flowerbedFromPoints(
        drawingFlowerbed.start,
        drawingFlowerbed.current,
      );
      if (rectangle.widthCm >= 10 && rectangle.heightCm >= 10) {
        const id = nextDraftId('flowerbed');
        setFlowerbeds((current) => [
          ...current,
          {
            id,
            ...rectangle,
            boundaryPoints: flowerbedBoundaryFromRectangle(rectangle),
          },
        ]);
        setSelectedObject(`flowerbed:${id}`);
      }
      setDrawingFlowerbed(null);
    }
    setDraggingPlant(null);
    setDraggingCorner(null);
    setDraggingFlowerbedCorner(null);
    setDraggingEdgeControl(null);
  };

  const deleteSelected = (): void => {
    if (!selectedObject) {
      return;
    }
    const [kind, id] = selectedObject.split(':');
    if (!id) {
      return;
    }
    if (kind === 'flowerbed') {
      setFlowerbeds((current) =>
        current.filter((flowerbed) => flowerbed.id !== id),
      );
      setPlacements((current) =>
        current.map((placement) =>
          placement.flowerbedId === id
            ? { ...placement, flowerbedId: null }
            : placement,
        ),
      );
    } else {
      setPlacements((current) => current.filter((plant) => plant.id !== id));
    }
    setSelectedObject(null);
    setSelectedEdge(null);
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
        setDrawingFlowerbed(null);
        setDraggingPlant(null);
        setSelectedObject(null);
        setSelectedEdge(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const save = async (): Promise<void> => {
    if (!name.trim() || !selectionId || flowerbeds.length === 0) {
      setError(
        'Indiquez un nom, une sélection et dessinez au moins un parterre.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    const input: PropertyPlanSaveInput = {
      id: propertyPlan?.id,
      name: name.trim(),
      selectionId,
      widthCm,
      heightCm,
      propertyBoundaryPoints: boundaryPoints.map((point) => ({
        xCm: point.x,
        yCm: point.y,
        ...(edgeKindOf(point) === 'line'
          ? {}
          : {
              edgeKind: edgeKindOf(point),
              edgeCurvature: edgeCurvatureOf(point),
            }),
      })),
      flowerbeds: flowerbeds.map((flowerbed) => ({
        id: flowerbed.id,
        xCm: flowerbed.xCm,
        yCm: flowerbed.yCm,
        widthCm: flowerbed.widthCm,
        heightCm: flowerbed.heightCm,
        boundaryPoints: flowerbed.boundaryPoints.map((point) => ({
          xCm: point.x,
          yCm: point.y,
          ...(edgeKindOf(point) === 'line'
            ? {}
            : {
                edgeKind: edgeKindOf(point),
                edgeCurvature: edgeCurvatureOf(point),
              }),
        })),
      })),
      placements,
    };
    try {
      await window.propertyPlanService.savePropertyPlan(input);
      onSaved();
    } catch {
      setError('Le plan n’a pas pu être enregistré.');
    } finally {
      setSaving(false);
    }
  };

  const drawingRectangle = drawingFlowerbed
    ? flowerbedFromPoints(drawingFlowerbed.start, drawingFlowerbed.current)
    : null;
  const propertyBoundaryPath = boundaryPathData(boundaryPoints);

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

  const startMovingEdgeMenu = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggingEdgeMenu({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffset: edgeMenuOffset,
    });
  };

  const moveEdgeMenu = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!draggingEdgeMenu || draggingEdgeMenu.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setEdgeMenuOffset({
      x:
        draggingEdgeMenu.startOffset.x +
        event.clientX -
        draggingEdgeMenu.startClientX,
      y:
        draggingEdgeMenu.startOffset.y +
        event.clientY -
        draggingEdgeMenu.startClientY,
    });
  };

  const stopMovingEdgeMenu = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    if (draggingEdgeMenu?.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    setDraggingEdgeMenu(null);
  };

  const moveEdgeMenuWithKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ): void => {
    const movementByKey: Partial<Record<string, Point>> = {
      ArrowUp: { x: 0, y: -10 },
      ArrowDown: { x: 0, y: 10 },
      ArrowLeft: { x: -10, y: 0 },
      ArrowRight: { x: 10, y: 0 },
    };
    const movement = movementByKey[event.key];
    if (!movement) {
      return;
    }
    event.preventDefault();
    setEdgeMenuOffset((current) => ({
      x: current.x + movement.x,
      y: current.y + movement.y,
    }));
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
          <h1>{propertyPlan ? 'Modifier le plan' : 'Nouveau plan'}</h1>
          <p>
            Limites de la propriété vues du dessus · dimensions en centimètres
          </p>
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
          aria-label="Outils du plan"
        >
          <label>
            Nom
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Plan de ma propriété"
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
          <fieldset className="flowerbed-property-dimensions">
            <legend>Dimensions de la propriété</legend>
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
              Longueur
              <input
                type="number"
                min="20"
                value={heightCm}
                onChange={(event) =>
                  setHeightCm(positiveDimension(event.target.value, heightCm))
                }
              />
            </label>
          </fieldset>
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
              className={mode === 'flowerbed' ? 'active' : ''}
              onClick={() => setMode('flowerbed')}
            >
              Dessiner un parterre
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
              <span className="legend-flowerbed" /> Parterre
            </p>
            <p>
              <span className="legend-warning" /> Chevauchement ou hors parterre
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
              aria-label="Zone de dessin du plan"
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
                  aria-label={`Plan de la propriété ${widthCm} par ${heightCm} centimètres`}
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
                    <clipPath id="property-boundary-clip">
                      <path d={propertyBoundaryPath} />
                    </clipPath>
                  </defs>
                  <path
                    className="property-boundary"
                    d={propertyBoundaryPath}
                  />
                  <rect
                    x="0"
                    y="0"
                    width={widthCm}
                    height={heightCm}
                    fill="url(#flowerbed-grid)"
                    clipPath="url(#property-boundary-clip)"
                    pointerEvents="none"
                  />
                  {flowerbeds.map((flowerbed, index) => (
                    <g key={flowerbed.id}>
                      <path
                        className={`plan-flowerbed ${selectedObject === `flowerbed:${flowerbed.id}` ? 'selected' : ''}`}
                        d={boundaryPathData(flowerbed.boundaryPoints)}
                        role="button"
                        aria-label={`Sélectionner le parterre ${index + 1}`}
                        onPointerDown={(event) => {
                          if (event.button !== 0 || mode !== 'select') {
                            return;
                          }
                          event.stopPropagation();
                          setSelectedObject(`flowerbed:${flowerbed.id}`);
                        }}
                        onClick={(event) => {
                          if (mode !== 'select') {
                            return;
                          }
                          event.stopPropagation();
                          setSelectedObject(`flowerbed:${flowerbed.id}`);
                        }}
                      />
                      <text
                        className="flowerbed-label"
                        x={flowerbed.xCm + 6}
                        y={flowerbed.yCm + 16}
                      >
                        Parterre {index + 1}
                      </text>
                      {flowerbed.boundaryPoints.map((point, edgeIndex) => {
                        const end =
                          flowerbed.boundaryPoints[
                            (edgeIndex + 1) % flowerbed.boundaryPoints.length
                          ];
                        if (!end) {
                          return null;
                        }
                        const isSelected =
                          selectedEdge?.owner.kind === 'flowerbed' &&
                          selectedEdge.owner.flowerbedId === flowerbed.id &&
                          selectedEdge.edgeIndex === edgeIndex;
                        return (
                          <path
                            key={`${flowerbed.id}-edge-${edgeIndex}`}
                            className={`polygon-edge-hit-area flowerbed-edge ${isSelected ? 'selected' : ''}`}
                            d={edgePathData(point, end)}
                            role="button"
                            aria-label={`Options de l’arête ${edgeIndex + 1} du parterre ${index + 1}`}
                            onPointerDown={(event) => {
                              if (event.button === 0) {
                                event.stopPropagation();
                              }
                            }}
                            onClick={(event) =>
                              selectEdge(
                                {
                                  kind: 'flowerbed',
                                  flowerbedId: flowerbed.id,
                                  flowerbedIndex: index,
                                },
                                edgeIndex,
                                flowerbed.boundaryPoints,
                                event,
                              )
                            }
                          />
                        );
                      })}
                      {selectedObject === `flowerbed:${flowerbed.id}`
                        ? flowerbed.boundaryPoints.map((point, cornerIndex) => (
                            <circle
                              key={`${flowerbed.id}-corner-${cornerIndex}`}
                              className={`planting-flowerbed-corner-handle ${draggingFlowerbedCorner?.flowerbedId === flowerbed.id && draggingFlowerbedCorner.cornerIndex === cornerIndex ? 'dragging' : ''}`}
                              cx={Math.max(
                                FLOWERBED_CORNER_HANDLE_RADIUS_CM,
                                Math.min(
                                  widthCm - FLOWERBED_CORNER_HANDLE_RADIUS_CM,
                                  point.x,
                                ),
                              )}
                              cy={Math.max(
                                FLOWERBED_CORNER_HANDLE_RADIUS_CM,
                                Math.min(
                                  heightCm - FLOWERBED_CORNER_HANDLE_RADIUS_CM,
                                  point.y,
                                ),
                              )}
                              r={FLOWERBED_CORNER_HANDLE_RADIUS_CM}
                              role="button"
                              aria-label={`Déplacer le coin ${cornerIndex + 1} du parterre ${index + 1}`}
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
                                setDraggingFlowerbedCorner({
                                  flowerbedId: flowerbed.id,
                                  cornerIndex,
                                });
                              }}
                            >
                              <title>
                                Parterre {index + 1}, coin {cornerIndex + 1}
                              </title>
                            </circle>
                          ))
                        : null}
                    </g>
                  ))}
                  {drawingRectangle ? (
                    <rect
                      className="plan-flowerbed drawing"
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
                  {boundaryPoints.map((point, edgeIndex) => {
                    const end =
                      boundaryPoints[(edgeIndex + 1) % boundaryPoints.length];
                    if (!end) {
                      return null;
                    }
                    const isSelected =
                      selectedEdge?.owner.kind === 'property' &&
                      selectedEdge.edgeIndex === edgeIndex;
                    return (
                      <path
                        key={`property-edge-${edgeIndex}`}
                        className={`polygon-edge-hit-area property-edge ${isSelected ? 'selected' : ''}`}
                        d={edgePathData(point, end)}
                        role="button"
                        aria-label={`Options de l’arête ${edgeIndex + 1} de la propriété`}
                        onPointerDown={(event) => {
                          if (event.button === 0) {
                            event.stopPropagation();
                          }
                        }}
                        onClick={(event) =>
                          selectEdge(
                            { kind: 'property' },
                            edgeIndex,
                            boundaryPoints,
                            event,
                          )
                        }
                      />
                    );
                  })}
                  {selectedEdge &&
                  selectedEdgeStart &&
                  selectedEdgeEnd &&
                  selectedEdgeControl ? (
                    <g className="edge-geometry-controls">
                      {edgeKindOf(selectedEdgeStart) === 'circular-arc' ? (
                        <>
                          <circle
                            className="edge-construction-circle"
                            cx={selectedEdgeControl.x}
                            cy={selectedEdgeControl.y}
                            r={Math.hypot(
                              selectedEdgeStart.x - selectedEdgeControl.x,
                              selectedEdgeStart.y - selectedEdgeControl.y,
                            )}
                          />
                          <line
                            className="edge-control-guide"
                            x1={selectedEdgeStart.x}
                            y1={selectedEdgeStart.y}
                            x2={selectedEdgeControl.x}
                            y2={selectedEdgeControl.y}
                          />
                          <line
                            className="edge-control-guide"
                            x1={selectedEdgeEnd.x}
                            y1={selectedEdgeEnd.y}
                            x2={selectedEdgeControl.x}
                            y2={selectedEdgeControl.y}
                          />
                        </>
                      ) : edgeKindOf(selectedEdgeStart) === 'bezier' ? (
                        <polyline
                          className="edge-control-guide"
                          points={`${selectedEdgeStart.x},${selectedEdgeStart.y} ${selectedEdgeControl.x},${selectedEdgeControl.y} ${selectedEdgeEnd.x},${selectedEdgeEnd.y}`}
                        />
                      ) : (
                        <line
                          className="edge-control-guide"
                          x1={
                            edgeMidpoint(selectedEdgeStart, selectedEdgeEnd).x
                          }
                          y1={
                            edgeMidpoint(selectedEdgeStart, selectedEdgeEnd).y
                          }
                          x2={selectedEdgeControl.x}
                          y2={selectedEdgeControl.y}
                        />
                      )}
                      <circle
                        className={`edge-curve-control-handle ${
                          draggingEdgeControl ? 'dragging' : ''
                        }`}
                        cx={selectedEdgeControl.x}
                        cy={selectedEdgeControl.y}
                        r={5}
                        role="button"
                        aria-label={
                          edgeKindOf(selectedEdgeStart) === 'circular-arc'
                            ? 'Déplacer le centre de l’arc de cercle'
                            : edgeKindOf(selectedEdgeStart) === 'elliptical-arc'
                              ? 'Modifier le rayon de l’arc elliptique'
                              : 'Déplacer le contrôle de la courbe de Bézier'
                        }
                        onPointerDown={(event) => {
                          if (event.button !== 0) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          event.currentTarget.ownerSVGElement?.setPointerCapture?.(
                            event.pointerId,
                          );
                          setDraggingEdgeControl({
                            pointerId: event.pointerId,
                          });
                        }}
                      >
                        <title>
                          Glissez ce point pour modifier la courbure
                        </title>
                      </circle>
                    </g>
                  ) : null}
                  {boundaryPoints.map((point, index) => (
                    <circle
                      key={`corner-${index}`}
                      className={`property-corner-handle ${draggingCorner === index ? 'dragging' : ''}`}
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
                      aria-label={`Déplacer le coin ${index + 1} de la propriété`}
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
                        Coin {index + 1} de la propriété · glissez pour modifier
                        la limite
                      </title>
                    </circle>
                  ))}
                </svg>
                {selectedEdge && selectedEdgeStart ? (
                  <div
                    className={`edge-context-menu ${
                      selectedEdge.anchor.x / widthCm < 0.2
                        ? 'align-left'
                        : selectedEdge.anchor.x / widthCm > 0.8
                          ? 'align-right'
                          : ''
                    } ${
                      selectedEdge.anchor.y / heightCm > 0.75
                        ? 'align-above'
                        : ''
                    }`}
                    role="menu"
                    aria-label={
                      selectedEdge.owner.kind === 'property'
                        ? `Arête ${selectedEdge.edgeIndex + 1} de la propriété`
                        : `Arête ${selectedEdge.edgeIndex + 1} du parterre ${selectedEdge.owner.flowerbedIndex + 1}`
                    }
                    style={{
                      left: `calc(${(selectedEdge.anchor.x / widthCm) * 100}% + ${edgeMenuOffset.x}px)`,
                      top: `calc(${(selectedEdge.anchor.y / heightCm) * 100}% + ${edgeMenuOffset.y}px)`,
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <div
                      className={`edge-context-menu-drag-handle ${
                        draggingEdgeMenu ? 'dragging' : ''
                      }`}
                      role="button"
                      tabIndex={0}
                      aria-label="Déplacer le menu de l’arête"
                      onPointerDown={startMovingEdgeMenu}
                      onPointerMove={moveEdgeMenu}
                      onPointerUp={stopMovingEdgeMenu}
                      onPointerCancel={stopMovingEdgeMenu}
                      onKeyDown={moveEdgeMenuWithKeyboard}
                    >
                      <span aria-hidden="true">⠿</span>
                      Déplacer
                    </div>
                    <label>
                      Nature
                      <select
                        aria-label="Nature de l’arête"
                        value={edgeKindOf(selectedEdgeStart)}
                        onChange={(event) =>
                          updateSelectedEdge(
                            event.target.value as BoundaryEdgeKind,
                          )
                        }
                      >
                        <option value="line">Ligne droite</option>
                        <option value="circular-arc">Arc de cercle</option>
                        <option value="elliptical-arc">Arc elliptique</option>
                        <option value="bezier">Courbe de Bézier</option>
                      </select>
                    </label>
                    {edgeKindOf(selectedEdgeStart) !== 'line' ? (
                      <>
                        <label>
                          Courbure
                          <input
                            type="range"
                            aria-label="Courbure de l’arête"
                            min="0.05"
                            max="0.5"
                            step="0.01"
                            value={Math.abs(edgeCurvatureOf(selectedEdgeStart))}
                            onChange={(event) =>
                              updateSelectedEdge(
                                edgeKindOf(selectedEdgeStart),
                                Math.sign(
                                  edgeCurvatureOf(selectedEdgeStart) || 1,
                                ) * Number(event.target.value),
                              )
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedEdge(
                              edgeKindOf(selectedEdgeStart),
                              -edgeCurvatureOf(selectedEdgeStart),
                            )
                          }
                        >
                          Inverser la courbure
                        </button>
                      </>
                    ) : null}
                    <button type="button" onClick={splitSelectedEdge}>
                      Scinder l’arête
                    </button>
                    <button
                      type="button"
                      className="edge-context-menu-close"
                      aria-label="Fermer le menu de l’arête"
                      onClick={() => setSelectedEdge(null)}
                    >
                      ×
                    </button>
                  </div>
                ) : null}
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
