import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from 'react';
import {
  Canvas,
  Circle,
  FabricText,
  Group,
  Path,
  Point,
  util,
  type FabricObject,
  type TPointerEventInfo,
} from 'fabric';
import {
  boundaryPathData,
  boundsFromPoints,
  edgePathData,
  sampleEdge,
  type BoundaryOwner,
  type EditorPoint,
  type PlanCanvasChange,
  type PlanEditorDocument,
  type PlanValidation,
  type SelectedBoundaryEdge,
} from './plan-editor-model';

export interface PlantPreview {
  readonly point: EditorPoint;
  readonly spacingCm: number;
  readonly color: string | null;
  readonly status: 'valid' | 'overlap' | 'outside' | 'both';
}

export interface FabricPlanCanvasHandle {
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly resetZoom: () => void;
  readonly fitToPlan: () => void;
  readonly panBy: (x: number, y: number) => void;
  readonly clientToPlan: (x: number, y: number) => EditorPoint | null;
  readonly showPlantPreview: (preview: PlantPreview) => void;
  readonly hidePlantPreview: () => void;
}

interface FabricPlanCanvasProps {
  readonly document: PlanEditorDocument;
  readonly validation: PlanValidation;
  readonly selectedPlantId: string | null;
  readonly selectedEdge: SelectedBoundaryEdge | null;
  readonly onPlantSelect: (id: string | null) => void;
  readonly onEdgeSelect: (edge: SelectedBoundaryEdge | null) => void;
  readonly onPlantMoved: (change: PlanCanvasChange) => void;
  readonly onBoundaryNodeMoved: (
    owner: BoundaryOwner,
    index: number,
    point: EditorPoint,
  ) => void;
  readonly onPlantContextMenu: (
    id: string,
    position: { readonly x: number; readonly y: number },
  ) => void;
  readonly onZoomChange: (zoom: number) => void;
}

type PlanObjectKind =
  'boundary' | 'edge' | 'node' | 'plant' | 'label' | 'preview';

type TaggedObject = FabricObject & {
  planKind?: PlanObjectKind;
  planId?: string;
  ownerKind?: BoundaryOwner['kind'];
  ownerId?: string;
  pointIndex?: number;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const VIEW_MARGIN_PX = 48;
const DIMENSION_LABEL_MARGIN_CM = 3;
const DIMENSION_LABEL_HALF_HEIGHT_CM = 7;

function colorLabelToCss(label: string | null): string {
  if (!label) {
    return '#6fb570';
  }
  const colors: Record<string, string> = {
    blanc: '#f8fafc',
    bleu: '#60a5fa',
    jaune: '#facc15',
    orange: '#fb923c',
    rose: '#ec4899',
    rouge: '#ef4444',
    vert: '#4ade80',
    violet: '#a78bfa',
  };
  const normalized = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .trim();
  return colors[normalized] ?? '#6fb570';
}

function ownerFromObject(object: FabricObject): BoundaryOwner | null {
  const tagged = object as TaggedObject;
  if (tagged.ownerKind === 'property') {
    return { kind: 'property' };
  }
  if (tagged.ownerKind === 'flowerbed' && tagged.ownerId) {
    return { kind: 'flowerbed', id: tagged.ownerId };
  }
  return null;
}

function ownersMatch(first: BoundaryOwner, second: BoundaryOwner): boolean {
  return (
    first.kind === second.kind &&
    (first.kind === 'property' ||
      (second.kind === 'flowerbed' && first.id === second.id))
  );
}

function pointsForOwner(
  document: PlanEditorDocument,
  owner: BoundaryOwner,
): PlanEditorDocument['propertyBoundaryPoints'] {
  return owner.kind === 'property'
    ? document.propertyBoundaryPoints
    : (document.flowerbeds.find((flowerbed) => flowerbed.id === owner.id)
        ?.boundaryPoints ?? []);
}

function tagBoundaryObject<T extends FabricObject>(
  object: T,
  planKind: PlanObjectKind,
  owner: BoundaryOwner,
  index?: number,
): T {
  const tagged = object as T & TaggedObject;
  tagged.planKind = planKind;
  tagged.ownerKind = owner.kind;
  tagged.ownerId = owner.kind === 'flowerbed' ? owner.id : undefined;
  tagged.pointIndex = index;
  return object;
}

function edgeIsSelected(
  edge: SelectedBoundaryEdge | null,
  owner: BoundaryOwner,
  index: number,
): boolean {
  return (
    edge?.index === index &&
    edge.owner.kind === owner.kind &&
    (owner.kind === 'property' ||
      (edge.owner.kind === 'flowerbed' && edge.owner.id === owner.id))
  );
}

function createPlantObject(
  placement: PlanEditorDocument['placements'][number],
  validation: PlanValidation,
  selected: boolean,
): Group {
  const radius = Math.max(4, placement.spacingCmSnapshot / 2);
  const outside = validation.outsideIds.has(placement.id);
  const overlapping = validation.overlappingIds.has(placement.id);
  const requiredSpace = new Circle({
    radius,
    originX: 'center',
    originY: 'center',
    fill: overlapping ? 'rgba(220, 38, 38, .14)' : 'rgba(47, 125, 50, .12)',
    stroke: overlapping ? '#dc2626' : outside ? '#d97706' : '#2f7d32',
    strokeWidth: selected ? 4 : 2,
    strokeDashArray: outside ? [8, 5] : undefined,
    strokeUniform: true,
  });
  const markerRadius = Math.max(6, Math.min(14, radius * 0.34));
  const marker = new Circle({
    radius: markerRadius,
    originX: 'center',
    originY: 'center',
    fill: colorLabelToCss(placement.colorSnapshot),
    stroke: overlapping ? '#991b1b' : '#245e26',
    strokeWidth: 2,
    strokeUniform: true,
  });
  const initial = new FabricText(
    placement.plantNameSnapshot.trim().slice(0, 1).toLocaleUpperCase('fr-FR'),
    {
      originX: 'center',
      originY: 'center',
      fontSize: Math.max(7, markerRadius),
      fontWeight: '700',
      fill: '#173e18',
    },
  );
  const parts: FabricObject[] = [requiredSpace, marker, initial];
  if (outside && overlapping) {
    parts.push(
      new Circle({
        radius: 6,
        left: radius * 0.7,
        top: -radius * 0.7,
        originX: 'center',
        originY: 'center',
        fill: '#f59e0b',
        stroke: '#fff',
        strokeWidth: 2,
        strokeUniform: true,
      }),
    );
  }
  const group = new Group(parts, {
    left: placement.xCm,
    top: placement.yCm,
    originX: 'center',
    originY: 'center',
    hasControls: false,
    hasBorders: false,
    lockRotation: true,
    lockScalingX: true,
    lockScalingY: true,
    hoverCursor: 'move',
  }) as Group & TaggedObject;
  group.planKind = 'plant';
  group.planId = placement.id;
  return group;
}

function edgeLabelLayout(
  points: PlanEditorDocument['propertyBoundaryPoints'],
  index: number,
): {
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly angle: number;
} | null {
  const start = points[index];
  const end = points[(index + 1) % points.length];
  if (!start || !end) {
    return null;
  }
  const samples = sampleEdge(start, end);
  if (samples.length < 2) {
    return null;
  }
  const lengthCm = samples.slice(1).reduce((total, point, sampleIndex) => {
    const previous = samples[sampleIndex];
    return previous
      ? total + Math.hypot(point.xCm - previous.xCm, point.yCm - previous.yCm)
      : total;
  }, 0);
  const middleIndex = Math.floor((samples.length - 1) / 2);
  const middle = samples[middleIndex];
  const before = samples[Math.max(0, middleIndex - 1)];
  const after = samples[Math.min(samples.length - 1, middleIndex + 1)];
  if (!middle || !before || !after) {
    return null;
  }
  const tangentX = after.xCm - before.xCm;
  const tangentY = after.yCm - before.yCm;
  const tangentLength = Math.hypot(tangentX, tangentY);
  if (tangentLength === 0) {
    return null;
  }
  const centroid = points.reduce(
    (total, point) => ({
      xCm: total.xCm + point.xCm / points.length,
      yCm: total.yCm + point.yCm / points.length,
    }),
    { xCm: 0, yCm: 0 },
  );
  let normalX = tangentY / tangentLength;
  let normalY = -tangentX / tangentLength;
  if (
    normalX * (middle.xCm - centroid.xCm) +
      normalY * (middle.yCm - centroid.yCm) <
    0
  ) {
    normalX = -normalX;
    normalY = -normalY;
  }
  let angle = (Math.atan2(tangentY, tangentX) * 180) / Math.PI;
  if (angle > 90) {
    angle -= 180;
  } else if (angle < -90) {
    angle += 180;
  }
  const offset = DIMENSION_LABEL_HALF_HEIGHT_CM + DIMENSION_LABEL_MARGIN_CM;
  return {
    text: `${Math.round(lengthCm)} cm`,
    left: middle.xCm + normalX * offset,
    top: middle.yCm + normalY * offset,
    angle,
  };
}

function flowerbedDocumentBounds(document: PlanEditorDocument): {
  readonly xCm: number;
  readonly yCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
} {
  const flowerbedBounds = document.flowerbeds.map((flowerbed) =>
    boundsFromPoints(flowerbed.boundaryPoints),
  );
  if (flowerbedBounds.length === 0) {
    return { xCm: 0, yCm: 0, widthCm: 1, heightCm: 1 };
  }
  const minX = Math.min(...flowerbedBounds.map((bounds) => bounds.xCm));
  const minY = Math.min(...flowerbedBounds.map((bounds) => bounds.yCm));
  const maxX = Math.max(
    ...flowerbedBounds.map((bounds) => bounds.xCm + bounds.widthCm),
  );
  const maxY = Math.max(
    ...flowerbedBounds.map((bounds) => bounds.yCm + bounds.heightCm),
  );
  return {
    xCm: minX,
    yCm: minY,
    widthCm: Math.max(1, maxX - minX),
    heightCm: Math.max(1, maxY - minY),
  };
}

function addBoundary(
  canvas: Canvas,
  points: PlanEditorDocument['propertyBoundaryPoints'],
  owner: BoundaryOwner,
  selectedEdge: SelectedBoundaryEdge | null,
): void {
  if (points.length < 2) {
    return;
  }
  canvas.add(
    tagBoundaryObject(
      new Path(boundaryPathData(points), {
        fill:
          owner.kind === 'property'
            ? 'rgba(255, 255, 255, .76)'
            : 'rgba(104, 155, 93, .16)',
        stroke: owner.kind === 'property' ? '#315a34' : '#53824d',
        strokeWidth: owner.kind === 'property' ? 3 : 2,
        strokeUniform: true,
        selectable: false,
        evented: false,
      }),
      'boundary',
      owner,
    ),
  );
  points.forEach((start, index) => {
    const end = points[(index + 1) % points.length];
    if (!end) {
      return;
    }
    const selected = edgeIsSelected(selectedEdge, owner, index);
    const objects: FabricObject[] = [
      tagBoundaryObject(
        new Path(edgePathData(start, end), {
          fill: '',
          stroke: selected ? '#f97316' : 'rgba(0,0,0,0.001)',
          strokeWidth: selected ? 5 : 14,
          strokeUniform: true,
          selectable: false,
          evented: true,
          hoverCursor: 'pointer',
        }),
        'edge',
        owner,
        index,
      ),
    ];
    const label = edgeLabelLayout(points, index);
    if (label) {
      objects.push(
        tagBoundaryObject(
          new FabricText(label.text, {
            left: label.left,
            top: label.top,
            originX: 'center',
            originY: 'center',
            angle: label.angle,
            fontSize: owner.kind === 'property' ? 11 : 10,
            fontWeight: '600',
            fill: '#526455',
            selectable: false,
            evented: false,
          }),
          'label',
          owner,
          index,
        ),
      );
    }
    canvas.add(...objects);
  });
  points.forEach((point, index) => {
    canvas.add(
      tagBoundaryObject(
        new Circle({
          left: point.xCm,
          top: point.yCm,
          radius: owner.kind === 'property' ? 6 : 5,
          originX: 'center',
          originY: 'center',
          fill: '#fff',
          stroke: owner.kind === 'property' ? '#315a34' : '#53824d',
          strokeWidth: 2,
          strokeUniform: true,
          hasControls: false,
          hasBorders: false,
          hoverCursor: 'move',
        }),
        'node',
        owner,
        index,
      ),
    );
  });
}

function FabricPlanCanvasComponent(
  props: FabricPlanCanvasProps,
  forwardedRef: Ref<FabricPlanCanvasHandle>,
) {
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const previewRef = useRef<Circle | null>(null);
  const panningRef = useRef<{ readonly x: number; readonly y: number } | null>(
    null,
  );
  const didFitRef = useRef(false);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  const notifyZoom = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      propsRef.current.onZoomChange(canvas.getZoom());
    }
  }, []);

  const zoomTo = useCallback(
    (next: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
      canvas.zoomToPoint(
        new Point(canvas.getWidth() / 2, canvas.getHeight() / 2),
        zoom,
      );
      canvas.requestRenderAll();
      notifyZoom();
    },
    [notifyZoom],
  );

  const fitToPlan = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const bounds = flowerbedDocumentBounds(propsRef.current.document);
    const availableWidth = Math.max(1, canvas.getWidth() - VIEW_MARGIN_PX * 2);
    const availableHeight = Math.max(
      1,
      canvas.getHeight() - VIEW_MARGIN_PX * 2,
    );
    const zoom = Math.max(
      MIN_ZOOM,
      Math.min(
        MAX_ZOOM,
        availableWidth / bounds.widthCm,
        availableHeight / bounds.heightCm,
      ),
    );
    const centerX = bounds.xCm + bounds.widthCm / 2;
    const centerY = bounds.yCm + bounds.heightCm / 2;
    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      canvas.getWidth() / 2 - centerX * zoom,
      canvas.getHeight() / 2 - centerY * zoom,
    ]);
    canvas.renderAll();
    notifyZoom();
  }, [notifyZoom]);

  const clientToPlan = useCallback(
    (x: number, y: number): EditorPoint | null => {
      const canvas = canvasRef.current;
      const element = canvasElementRef.current;
      if (!canvas || !element) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      const point = util.transformPoint(
        new Point(x - rect.left, y - rect.top),
        util.invertTransform(canvas.viewportTransform),
      );
      return { xCm: point.x, yCm: point.y };
    },
    [],
  );

  const hidePlantPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas && previewRef.current) {
      canvas.remove(previewRef.current);
      previewRef.current = null;
      canvas.requestRenderAll();
    }
  }, []);

  const showPlantPreview = useCallback(
    (preview: PlantPreview) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      hidePlantPreview();
      const object = new Circle({
        left: preview.point.xCm,
        top: preview.point.yCm,
        radius: preview.spacingCm / 2,
        originX: 'center',
        originY: 'center',
        fill:
          preview.status === 'valid'
            ? `${colorLabelToCss(preview.color)}44`
            : preview.status === 'outside'
              ? 'rgba(217, 119, 6, .18)'
              : 'rgba(220, 38, 38, .2)',
        stroke:
          preview.status === 'valid'
            ? '#2f7d32'
            : preview.status === 'outside'
              ? '#d97706'
              : '#dc2626',
        strokeWidth: 3,
        strokeDashArray: [8, 5],
        strokeUniform: true,
        selectable: false,
        evented: false,
      }) as Circle & TaggedObject;
      object.planKind = 'preview';
      previewRef.current = object;
      canvas.add(object);
      canvas.requestRenderAll();
    },
    [hidePlantPreview],
  );

  useImperativeHandle(forwardedRef, () => ({
    zoomIn: () => zoomTo((canvasRef.current?.getZoom() ?? 1) * 1.2),
    zoomOut: () => zoomTo((canvasRef.current?.getZoom() ?? 1) / 1.2),
    resetZoom: () => zoomTo(1),
    fitToPlan,
    panBy: (x, y) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const viewport = [
        ...canvas.viewportTransform,
      ] as typeof canvas.viewportTransform;
      viewport[4] += x;
      viewport[5] += y;
      canvas.setViewportTransform(viewport);
      canvas.requestRenderAll();
    },
    clientToPlan,
    showPlantPreview,
    hidePlantPreview,
  }));

  useEffect(() => {
    const element = canvasElementRef.current;
    const viewport = viewportRef.current;
    if (!element || !viewport) {
      return;
    }
    const canvas = new Canvas(element, {
      selection: false,
      preserveObjectStacking: true,
      fireRightClick: true,
      stopContextMenu: true,
    });
    canvasRef.current = canvas;

    const mouseDown = (event: TPointerEventInfo): void => {
      const pointer = event.e as MouseEvent;
      if (pointer.button === 1 || pointer.altKey) {
        panningRef.current = { x: pointer.clientX, y: pointer.clientY };
        canvas.defaultCursor = 'grabbing';
        return;
      }
      const target = event.target as TaggedObject | undefined;
      if (
        pointer.button === 2 &&
        target?.planKind === 'plant' &&
        target.planId
      ) {
        propsRef.current.onPlantContextMenu(target.planId, {
          x: pointer.clientX,
          y: pointer.clientY,
        });
        return;
      }
      if (target?.planKind === 'plant' && target.planId) {
        propsRef.current.onPlantSelect(target.planId);
        propsRef.current.onEdgeSelect(null);
      } else if (
        target?.planKind === 'edge' &&
        target.pointIndex !== undefined
      ) {
        const owner = ownerFromObject(target);
        if (owner) {
          propsRef.current.onPlantSelect(null);
          propsRef.current.onEdgeSelect({ owner, index: target.pointIndex });
        }
      } else if (target?.planKind !== 'node') {
        propsRef.current.onPlantSelect(null);
        propsRef.current.onEdgeSelect(null);
      }
    };

    const mouseMove = (event: TPointerEventInfo): void => {
      const pointer = event.e as MouseEvent;
      const pan = panningRef.current;
      if (!pan) {
        return;
      }
      const transform = [
        ...canvas.viewportTransform,
      ] as typeof canvas.viewportTransform;
      transform[4] += pointer.clientX - pan.x;
      transform[5] += pointer.clientY - pan.y;
      canvas.setViewportTransform(transform);
      panningRef.current = { x: pointer.clientX, y: pointer.clientY };
      canvas.requestRenderAll();
    };

    const mouseUp = (): void => {
      if (panningRef.current) {
        panningRef.current = null;
        canvas.defaultCursor = 'default';
        notifyZoom();
      }
    };

    const objectModified = ({ target }: { target: FabricObject }): void => {
      const tagged = target as TaggedObject;
      const center = target.getCenterPoint();
      if (tagged.planKind === 'plant' && tagged.planId) {
        propsRef.current.onPlantMoved({
          kind: 'plant',
          id: tagged.planId,
          xCm: center.x,
          yCm: center.y,
        });
      } else if (
        tagged.planKind === 'node' &&
        tagged.pointIndex !== undefined
      ) {
        const owner = ownerFromObject(target);
        if (owner) {
          propsRef.current.onBoundaryNodeMoved(owner, tagged.pointIndex, {
            xCm: center.x,
            yCm: center.y,
          });
        }
      }
    };

    const objectMoving = ({ target }: { target: FabricObject }): void => {
      const tagged = target as TaggedObject;
      if (tagged.planKind !== 'node' || tagged.pointIndex === undefined) {
        return;
      }
      const owner = ownerFromObject(target);
      if (!owner) {
        return;
      }
      const center = target.getCenterPoint();
      const points = pointsForOwner(propsRef.current.document, owner).map(
        (point, index) =>
          index === tagged.pointIndex
            ? { ...point, xCm: center.x, yCm: center.y }
            : point,
      );
      canvas.getObjects().forEach((object) => {
        const objectOwner = ownerFromObject(object);
        if (!objectOwner || !ownersMatch(owner, objectOwner)) {
          return;
        }
        const objectTag = object as TaggedObject;
        if (object instanceof Path && objectTag.planKind === 'boundary') {
          object._setPath(boundaryPathData(points), true);
        } else if (
          object instanceof Path &&
          objectTag.planKind === 'edge' &&
          objectTag.pointIndex !== undefined
        ) {
          const start = points[objectTag.pointIndex];
          const end = points[(objectTag.pointIndex + 1) % points.length];
          if (start && end) {
            object._setPath(edgePathData(start, end), true);
          }
        } else if (
          object instanceof FabricText &&
          objectTag.planKind === 'label' &&
          objectTag.pointIndex !== undefined
        ) {
          const label = edgeLabelLayout(points, objectTag.pointIndex);
          if (label) {
            object.set(label);
            object.initDimensions();
          }
        }
        object.dirty = true;
        object.setCoords();
      });
      canvas.renderAll();
    };

    const mouseWheel = (event: TPointerEventInfo<WheelEvent>): void => {
      event.e.preventDefault();
      event.e.stopPropagation();
      const zoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, canvas.getZoom() * Math.pow(0.999, event.e.deltaY)),
      );
      canvas.zoomToPoint(event.viewportPoint, zoom);
      canvas.requestRenderAll();
      notifyZoom();
    };

    canvas.on('mouse:down', mouseDown);
    canvas.on('mouse:move', mouseMove);
    canvas.on('mouse:up', mouseUp);
    canvas.on('mouse:wheel', mouseWheel);
    canvas.on('object:moving', objectMoving);
    canvas.on('object:modified', objectModified);

    const resize = (): void => {
      const width = Math.max(320, viewport.clientWidth || 800);
      const height = Math.max(360, viewport.clientHeight || 560);
      if (canvas.getWidth() === width && canvas.getHeight() === height) {
        return;
      }
      canvas.setDimensions({ width, height });
      if (!didFitRef.current) {
        didFitRef.current = true;
        fitToPlan();
      } else {
        canvas.renderAll();
      }
    };
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(viewport);
    resize();
    return () => {
      observer?.disconnect();
      canvasRef.current = null;
      // Fabric defers destruction while a render frame is pending. React
      // StrictMode immediately mounts a replacement canvas, so allowing that
      // deferred cleanup to run can destroy the replacement's shared element.
      canvas.cancelRequestedRender();
      void canvas.dispose();
    };
  }, [fitToPlan, notifyZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    previewRef.current = null;
    canvas.clear();
    props.document.flowerbeds.forEach((flowerbed) =>
      addBoundary(
        canvas,
        flowerbed.boundaryPoints,
        { kind: 'flowerbed', id: flowerbed.id },
        props.selectedEdge,
      ),
    );
    props.document.placements.forEach((placement) =>
      canvas.add(
        createPlantObject(
          placement,
          props.validation,
          props.selectedPlantId === placement.id,
        ),
      ),
    );
    canvas.renderAll();
  }, [
    props.document,
    props.selectedEdge,
    props.selectedPlantId,
    props.validation,
  ]);

  return (
    <div ref={viewportRef} className="fabric-plan-viewport">
      <canvas ref={canvasElementRef} aria-label="Plan interactif du parterre" />
    </div>
  );
}

export const FabricPlanCanvas = forwardRef(FabricPlanCanvasComponent);
