import type {
  BoundaryEdgeKind,
  FlowerbedInput,
  PropertyBoundaryPoint,
  PropertyPlanDesign,
  PropertyPlanPlantPlacementInput,
} from './property-plan';

export interface EditorPoint {
  readonly xCm: number;
  readonly yCm: number;
}

export type EditorFlowerbed = Omit<FlowerbedInput, 'id' | 'boundaryPoints'> & {
  readonly id: string;
  readonly boundaryPoints: readonly PropertyBoundaryPoint[];
};

export type EditorPlacement = Omit<PropertyPlanPlantPlacementInput, 'id'> & {
  readonly id: string;
};

export interface PlanEditorDocument {
  readonly propertyBoundaryPoints: readonly PropertyBoundaryPoint[];
  readonly flowerbeds: readonly EditorFlowerbed[];
  readonly placements: readonly EditorPlacement[];
}

export type PlanObjectId =
  'property' | `flowerbed:${string}` | `plant:${string}`;

export type BoundaryOwner =
  | { readonly kind: 'property' }
  | { readonly kind: 'flowerbed'; readonly id: string };

export interface SelectedBoundaryEdge {
  readonly owner: BoundaryOwner;
  readonly index: number;
}

export interface PlanValidation {
  readonly overlappingIds: ReadonlySet<string>;
  readonly outsideIds: ReadonlySet<string>;
  readonly overlapPartners: ReadonlyMap<string, readonly string[]>;
}

export type PlanCanvasChange =
  | {
      readonly kind: 'property';
      readonly boundaryPoints: readonly PropertyBoundaryPoint[];
    }
  | {
      readonly kind: 'flowerbed';
      readonly id: string;
      readonly boundaryPoints: readonly PropertyBoundaryPoint[];
    }
  | {
      readonly kind: 'plant';
      readonly id: string;
      readonly xCm: number;
      readonly yCm: number;
    };

let draftSequence = 0;
const CURVE_SAMPLE_COUNT = 24;

const defaultEdgeCurvature: Record<
  Exclude<BoundaryEdgeKind, 'line'>,
  number
> = {
  'circular-arc': 0.2,
  'elliptical-arc': 0.3,
  bezier: 0.22,
};

export function nextDraftId(prefix: string): string {
  draftSequence += 1;
  return `draft-${prefix}-${draftSequence}`;
}

export function rectangularBoundary(
  widthCm: number,
  heightCm: number,
): readonly PropertyBoundaryPoint[] {
  return [
    { xCm: 0, yCm: 0 },
    { xCm: widthCm, yCm: 0 },
    { xCm: widthCm, yCm: heightCm },
    { xCm: 0, yCm: heightCm },
  ];
}

export function createEditorDocument(
  propertyPlan: PropertyPlanDesign | null,
  widthCm: number,
  heightCm: number,
): PlanEditorDocument {
  const propertyBoundaryPoints =
    propertyPlan?.propertyBoundaryPoints ??
    rectangularBoundary(widthCm, heightCm);
  const savedFlowerbeds =
    propertyPlan?.flowerbeds.map((flowerbed) => ({
      ...flowerbed,
      boundaryPoints: flowerbed.boundaryPoints,
    })) ?? [];
  const flowerbeds =
    savedFlowerbeds.length > 0
      ? savedFlowerbeds
      : [
          {
            id: nextDraftId('flowerbed'),
            ...boundsFromPoints(propertyBoundaryPoints),
            boundaryPoints: propertyBoundaryPoints,
          },
        ];
  return {
    propertyBoundaryPoints:
      flowerbeds[0]?.boundaryPoints ?? propertyBoundaryPoints,
    flowerbeds,
    placements:
      propertyPlan?.placements.map((placement) => ({ ...placement })) ?? [],
  };
}

export function boundsFromPoints(points: readonly PropertyBoundaryPoint[]): {
  readonly xCm: number;
  readonly yCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
} {
  if (points.length === 0) {
    return { xCm: 0, yCm: 0, widthCm: 1, heightCm: 1 };
  }
  const samples = sampleBoundary(points);
  const xValues = samples.map((point) => point.xCm);
  const yValues = samples.map((point) => point.yCm);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  return {
    xCm: minX,
    yCm: minY,
    widthCm: Math.max(1, maxX - minX),
    heightCm: Math.max(1, maxY - minY),
  };
}

export function edgeKindOf(point: PropertyBoundaryPoint): BoundaryEdgeKind {
  return point.edgeKind ?? 'line';
}

export function edgeCurvatureOf(point: PropertyBoundaryPoint): number {
  const kind = edgeKindOf(point);
  return kind === 'line'
    ? 0
    : (point.edgeCurvature ?? defaultEdgeCurvature[kind]);
}

function edgeMidpoint(
  start: PropertyBoundaryPoint,
  end: PropertyBoundaryPoint,
): EditorPoint {
  return { xCm: (start.xCm + end.xCm) / 2, yCm: (start.yCm + end.yCm) / 2 };
}

function edgePerpendicular(
  start: PropertyBoundaryPoint,
  end: PropertyBoundaryPoint,
): EditorPoint {
  const xDistance = end.xCm - start.xCm;
  const yDistance = end.yCm - start.yCm;
  const length = Math.hypot(xDistance, yDistance);
  return length === 0
    ? { xCm: 0, yCm: 0 }
    : { xCm: -yDistance / length, yCm: xDistance / length };
}

export function edgePointAt(
  start: PropertyBoundaryPoint,
  end: PropertyBoundaryPoint,
  ratio: number,
): EditorPoint {
  const xDistance = end.xCm - start.xCm;
  const yDistance = end.yCm - start.yCm;
  const chordLength = Math.hypot(xDistance, yDistance);
  const linear = {
    xCm: start.xCm + xDistance * ratio,
    yCm: start.yCm + yDistance * ratio,
  };
  const kind = edgeKindOf(start);
  const curvature = edgeCurvatureOf(start);
  if (kind === 'line' || chordLength === 0 || Math.abs(curvature) < 0.001) {
    return linear;
  }
  const perpendicular = edgePerpendicular(start, end);
  const sagitta = curvature * chordLength;
  const halfChord = chordLength / 2;
  const localX = -halfChord + chordLength * ratio;
  let offset: number;
  if (kind === 'bezier') {
    offset = 4 * sagitta * ratio * (1 - ratio);
  } else if (kind === 'elliptical-arc') {
    offset =
      Math.sign(sagitta) *
      Math.abs(sagitta) *
      Math.sqrt(Math.max(0, 1 - (localX * localX) / (halfChord * halfChord)));
  } else {
    const centerOffset =
      (sagitta * sagitta - halfChord * halfChord) / (2 * sagitta);
    const radius = Math.hypot(halfChord, centerOffset);
    offset =
      centerOffset +
      Math.sign(sagitta) *
        Math.sqrt(Math.max(0, radius * radius - localX * localX));
  }
  return {
    xCm: linear.xCm + perpendicular.xCm * offset,
    yCm: linear.yCm + perpendicular.yCm * offset,
  };
}

export function sampleEdge(
  start: PropertyBoundaryPoint,
  end: PropertyBoundaryPoint,
  sampleCount = CURVE_SAMPLE_COUNT,
): readonly EditorPoint[] {
  return Array.from({ length: sampleCount + 1 }, (_, index) =>
    edgePointAt(start, end, index / sampleCount),
  );
}

export function sampleBoundary(
  points: readonly PropertyBoundaryPoint[],
): readonly EditorPoint[] {
  return points.flatMap((start, index) => {
    const end = points[(index + 1) % points.length];
    return end ? sampleEdge(start, end).slice(0, -1) : [];
  });
}

export function edgePathData(
  start: PropertyBoundaryPoint,
  end: PropertyBoundaryPoint,
): string {
  return sampleEdge(start, end)
    .map(
      (point, index) => `${index === 0 ? 'M' : 'L'} ${point.xCm} ${point.yCm}`,
    )
    .join(' ');
}

export function boundaryPathData(
  points: readonly PropertyBoundaryPoint[],
): string {
  const samples = sampleBoundary(points);
  return samples.length === 0
    ? ''
    : `${samples
        .map(
          (point, index) =>
            `${index === 0 ? 'M' : 'L'} ${point.xCm} ${point.yCm}`,
        )
        .join(' ')} Z`;
}

export function edgeControlPoint(
  start: PropertyBoundaryPoint,
  end: PropertyBoundaryPoint,
): EditorPoint {
  return edgePointAt(start, end, 0.5);
}

export function curvatureFromControlPoint(
  kind: Exclude<BoundaryEdgeKind, 'line'>,
  start: PropertyBoundaryPoint,
  end: PropertyBoundaryPoint,
  control: EditorPoint,
): number {
  const midpoint = edgeMidpoint(start, end);
  const perpendicular = edgePerpendicular(start, end);
  const chordLength = Math.hypot(end.xCm - start.xCm, end.yCm - start.yCm);
  if (chordLength === 0) {
    return edgeCurvatureOf(start);
  }
  const projectedOffset =
    (control.xCm - midpoint.xCm) * perpendicular.xCm +
    (control.yCm - midpoint.yCm) * perpendicular.yCm;
  const raw = projectedOffset / chordLength / (kind === 'bezier' ? 1 : 1);
  const sign = Math.sign(raw || edgeCurvatureOf(start) || 1);
  return sign * Math.min(0.5, Math.max(0.05, Math.abs(raw)));
}

export function insertPointAfter(
  points: readonly PropertyBoundaryPoint[],
  edgeIndex: number,
): readonly PropertyBoundaryPoint[] {
  const start = points[edgeIndex];
  const end = points[(edgeIndex + 1) % points.length];
  if (!start || !end) {
    return points;
  }
  const midpoint = edgePointAt(start, end, 0.5);
  return [
    ...points.slice(0, edgeIndex + 1),
    {
      ...midpoint,
      ...(start.edgeKind ? { edgeKind: start.edgeKind } : {}),
      ...(start.edgeCurvature === undefined
        ? {}
        : { edgeCurvature: start.edgeCurvature }),
    },
    ...points.slice(edgeIndex + 1),
  ];
}

export function flowerbedFromRectangle(
  start: EditorPoint,
  end: EditorPoint,
): EditorFlowerbed {
  const xCm = Math.min(start.xCm, end.xCm);
  const yCm = Math.min(start.yCm, end.yCm);
  const widthCm = Math.abs(end.xCm - start.xCm);
  const heightCm = Math.abs(end.yCm - start.yCm);
  return {
    id: nextDraftId('flowerbed'),
    xCm,
    yCm,
    widthCm,
    heightCm,
    boundaryPoints: [
      { xCm, yCm },
      { xCm: xCm + widthCm, yCm },
      { xCm: xCm + widthCm, yCm: yCm + heightCm },
      { xCm, yCm: yCm + heightCm },
    ],
  };
}

export function pointInsidePolygon(
  point: EditorPoint,
  polygon: readonly PropertyBoundaryPoint[],
): boolean {
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
      currentPoint.yCm > point.yCm !== previousPoint.yCm > point.yCm &&
      point.xCm <
        ((previousPoint.xCm - currentPoint.xCm) *
          (point.yCm - currentPoint.yCm)) /
          (previousPoint.yCm - currentPoint.yCm) +
          currentPoint.xCm;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

export function circleInsideBoundary(
  placement: EditorPlacement,
  boundary: readonly PropertyBoundaryPoint[],
): boolean {
  const radius = placement.spacingCmSnapshot / 2;
  const center = { xCm: placement.xCm, yCm: placement.yCm };
  const sampledBoundary = sampleBoundary(boundary);
  if (!pointInsidePolygon(center, sampledBoundary)) {
    return false;
  }
  for (let index = 0; index < sampledBoundary.length; index += 1) {
    const start = sampledBoundary[index];
    const end = sampledBoundary[(index + 1) % sampledBoundary.length];
    if (!start || !end) {
      continue;
    }
    if (distanceToSegment(center, start, end) < radius) {
      return false;
    }
  }
  return true;
}

function distanceToSegment(
  point: EditorPoint,
  start: PropertyBoundaryPoint,
  end: PropertyBoundaryPoint,
): number {
  const segmentX = end.xCm - start.xCm;
  const segmentY = end.yCm - start.yCm;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) {
    return Math.hypot(point.xCm - start.xCm, point.yCm - start.yCm);
  }
  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((point.xCm - start.xCm) * segmentX +
        (point.yCm - start.yCm) * segmentY) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.xCm - (start.xCm + ratio * segmentX),
    point.yCm - (start.yCm + ratio * segmentY),
  );
}

export function placementsOverlap(
  first: EditorPlacement,
  second: EditorPlacement,
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

export function invalidPlacementIds(
  document: PlanEditorDocument,
): ReadonlySet<string> {
  const validation = validatePlan(document);
  return new Set([...validation.overlappingIds, ...validation.outsideIds]);
}

export function validatePlan(document: PlanEditorDocument): PlanValidation {
  const overlappingIds = new Set<string>();
  const outsideIds = new Set<string>();
  const overlapPartners = new Map<string, string[]>();
  for (const placement of document.placements) {
    const insideAFlowerbed = document.flowerbeds.some((flowerbed) =>
      circleInsideBoundary(placement, flowerbed.boundaryPoints),
    );
    if (!insideAFlowerbed) {
      outsideIds.add(placement.id);
    }
    for (const other of document.placements) {
      if (placement.id !== other.id && placementsOverlap(placement, other)) {
        overlappingIds.add(placement.id);
        const partners = overlapPartners.get(placement.id) ?? [];
        partners.push(other.id);
        overlapPartners.set(placement.id, partners);
      }
    }
  }
  return { overlappingIds, outsideIds, overlapPartners };
}

export function applyCanvasChanges(
  document: PlanEditorDocument,
  changes: readonly PlanCanvasChange[],
): PlanEditorDocument {
  let propertyBoundaryPoints = document.propertyBoundaryPoints;
  const flowerbedChanges = new Map<string, readonly PropertyBoundaryPoint[]>();
  const plantChanges = new Map<
    string,
    { readonly xCm: number; readonly yCm: number }
  >();
  for (const change of changes) {
    if (change.kind === 'property') {
      propertyBoundaryPoints = change.boundaryPoints;
    } else if (change.kind === 'flowerbed') {
      flowerbedChanges.set(change.id, change.boundaryPoints);
    } else {
      plantChanges.set(change.id, {
        xCm: change.xCm,
        yCm: change.yCm,
      });
    }
  }
  const flowerbeds = document.flowerbeds.map((flowerbed) => {
    const boundaryPoints = flowerbedChanges.get(flowerbed.id);
    if (!boundaryPoints) {
      return flowerbed;
    }
    return {
      ...flowerbed,
      ...boundsFromPoints(boundaryPoints),
      boundaryPoints,
    };
  });
  const placements = document.placements.map((placement) => {
    const position = plantChanges.get(placement.id);
    if (!position) {
      return placement;
    }
    const flowerbedId =
      flowerbeds.find((flowerbed) =>
        pointInsidePolygon(position, sampleBoundary(flowerbed.boundaryPoints)),
      )?.id ?? null;
    return { ...placement, ...position, flowerbedId };
  });
  return { propertyBoundaryPoints, flowerbeds, placements };
}

export function deleteObjects(
  document: PlanEditorDocument,
  objectIds: readonly PlanObjectId[],
): PlanEditorDocument {
  const flowerbedIds = new Set(
    objectIds
      .filter((id): id is `flowerbed:${string}` => id.startsWith('flowerbed:'))
      .map((id) => id.slice('flowerbed:'.length)),
  );
  const plantIds = new Set(
    objectIds
      .filter((id): id is `plant:${string}` => id.startsWith('plant:'))
      .map((id) => id.slice('plant:'.length)),
  );
  return {
    ...document,
    flowerbeds: document.flowerbeds.filter(
      (flowerbed) => !flowerbedIds.has(flowerbed.id),
    ),
    placements: document.placements
      .filter((placement) => !plantIds.has(placement.id))
      .map((placement) =>
        placement.flowerbedId && flowerbedIds.has(placement.flowerbedId)
          ? { ...placement, flowerbedId: null }
          : placement,
      ),
  };
}

export function duplicateObjects(
  document: PlanEditorDocument,
  objectIds: readonly PlanObjectId[],
  offsetCm = 10,
): {
  readonly document: PlanEditorDocument;
  readonly selectedIds: readonly PlanObjectId[];
} {
  const duplicatedFlowerbeds: EditorFlowerbed[] = [];
  const duplicatedPlacements: EditorPlacement[] = [];
  const selectedIds: PlanObjectId[] = [];
  const duplicatedFlowerbedIds = new Map<string, string>();

  for (const source of document.flowerbeds) {
    if (!objectIds.includes(`flowerbed:${source.id}`)) {
      continue;
    }
    const id = nextDraftId('flowerbed');
    duplicatedFlowerbedIds.set(source.id, id);
    duplicatedFlowerbeds.push({
      ...source,
      id,
      xCm: source.xCm + offsetCm,
      yCm: source.yCm + offsetCm,
      boundaryPoints: source.boundaryPoints.map((point) => ({
        xCm: point.xCm + offsetCm,
        yCm: point.yCm + offsetCm,
      })),
    });
    selectedIds.push(`flowerbed:${id}`);
  }

  for (const source of document.placements) {
    if (!objectIds.includes(`plant:${source.id}`)) {
      continue;
    }
    const id = nextDraftId('plant');
    duplicatedPlacements.push({
      ...source,
      id,
      flowerbedId: source.flowerbedId
        ? (duplicatedFlowerbedIds.get(source.flowerbedId) ?? source.flowerbedId)
        : null,
      xCm: source.xCm + offsetCm,
      yCm: source.yCm + offsetCm,
    });
    selectedIds.push(`plant:${id}`);
  }

  return {
    document: {
      ...document,
      flowerbeds: [...document.flowerbeds, ...duplicatedFlowerbeds],
      placements: [...document.placements, ...duplicatedPlacements],
    },
    selectedIds,
  };
}

export function moveObjects(
  document: PlanEditorDocument,
  objectIds: readonly PlanObjectId[],
  xOffsetCm: number,
  yOffsetCm: number,
): PlanEditorDocument {
  const moveProperty = objectIds.includes('property');
  const flowerbedIds = new Set(
    objectIds
      .filter((id): id is `flowerbed:${string}` => id.startsWith('flowerbed:'))
      .map((id) => id.slice('flowerbed:'.length)),
  );
  const plantIds = new Set(
    objectIds
      .filter((id): id is `plant:${string}` => id.startsWith('plant:'))
      .map((id) => id.slice('plant:'.length)),
  );
  const movePoints = (
    points: readonly PropertyBoundaryPoint[],
  ): readonly PropertyBoundaryPoint[] =>
    points.map((point) => ({
      xCm: point.xCm + xOffsetCm,
      yCm: point.yCm + yOffsetCm,
    }));
  return {
    propertyBoundaryPoints: moveProperty
      ? movePoints(document.propertyBoundaryPoints)
      : document.propertyBoundaryPoints,
    flowerbeds: document.flowerbeds.map((flowerbed) =>
      flowerbedIds.has(flowerbed.id)
        ? {
            ...flowerbed,
            xCm: flowerbed.xCm + xOffsetCm,
            yCm: flowerbed.yCm + yOffsetCm,
            boundaryPoints: movePoints(flowerbed.boundaryPoints),
          }
        : flowerbed,
    ),
    placements: document.placements.map((placement) =>
      plantIds.has(placement.id)
        ? {
            ...placement,
            xCm: placement.xCm + xOffsetCm,
            yCm: placement.yCm + yOffsetCm,
          }
        : placement,
    ),
  };
}
