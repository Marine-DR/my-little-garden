import { describe, expect, it } from 'vitest';
import {
  applyCanvasChanges,
  boundaryPathData,
  createEditorDocument,
  deleteObjects,
  duplicateObjects,
  edgePointAt,
  insertPointAfter,
  invalidPlacementIds,
  moveObjects,
  sampleBoundary,
  validatePlan,
  type PlanEditorDocument,
} from '@my-little-garden/core';

const document: PlanEditorDocument = {
  propertyBoundaryPoints: [
    { xCm: 0, yCm: 0 },
    { xCm: 300, yCm: 0 },
    { xCm: 300, yCm: 200 },
    { xCm: 0, yCm: 200 },
  ],
  flowerbeds: [
    {
      id: 'bed-1',
      xCm: 20,
      yCm: 20,
      widthCm: 200,
      heightCm: 140,
      boundaryPoints: [
        { xCm: 20, yCm: 20 },
        { xCm: 220, yCm: 20 },
        { xCm: 220, yCm: 160 },
        { xCm: 20, yCm: 160 },
      ],
    },
  ],
  placements: [
    {
      id: 'plant-1',
      flowerbedId: 'bed-1',
      plantId: 'rose',
      plantNameSnapshot: 'Rose',
      spacingCmSnapshot: 30,
      colorSnapshot: 'Rose',
      xCm: 80,
      yCm: 80,
    },
  ],
};

describe('Fabric plan editor document operations', () => {
  it('applies one Fabric transform transaction to domain objects', () => {
    const next = applyCanvasChanges(document, [
      {
        kind: 'flowerbed',
        id: 'bed-1',
        boundaryPoints: [
          { xCm: 30, yCm: 25 },
          { xCm: 250, yCm: 25 },
          { xCm: 250, yCm: 175 },
          { xCm: 30, yCm: 175 },
        ],
      },
      { kind: 'plant', id: 'plant-1', xCm: 120, yCm: 90 },
    ]);

    expect(next.flowerbeds[0]).toMatchObject({
      xCm: 30,
      yCm: 25,
      widthCm: 220,
      heightCm: 150,
    });
    expect(next.placements[0]).toMatchObject({
      xCm: 120,
      yCm: 90,
      flowerbedId: 'bed-1',
    });
  });

  it('duplicates selected domain objects with new ids and an offset', () => {
    const result = duplicateObjects(document, [
      'flowerbed:bed-1',
      'plant:plant-1',
    ]);

    expect(result.document.flowerbeds).toHaveLength(2);
    expect(result.document.placements).toHaveLength(2);
    expect(result.document.flowerbeds[1]).toMatchObject({
      xCm: 30,
      yCm: 30,
    });
    expect(result.document.placements[1]).toMatchObject({
      xCm: 90,
      yCm: 90,
      flowerbedId: result.document.flowerbeds[1]?.id,
    });
    expect(result.selectedIds).toHaveLength(2);
  });

  it('deletes flowerbeds without deleting their plants', () => {
    const next = deleteObjects(document, ['flowerbed:bed-1']);

    expect(next.flowerbeds).toHaveLength(0);
    expect(next.placements).toEqual([
      expect.objectContaining({ id: 'plant-1', flowerbedId: null }),
    ]);
  });

  it('marks overlaps and out-of-bound placements as invalid', () => {
    const next: PlanEditorDocument = {
      ...document,
      placements: [
        ...document.placements,
        {
          ...document.placements[0]!,
          id: 'plant-2',
          xCm: 85,
          yCm: 80,
        },
        {
          ...document.placements[0]!,
          id: 'plant-3',
          xCm: 295,
          yCm: 195,
        },
      ],
    };

    expect([...invalidPlacementIds(next)].sort()).toEqual([
      'plant-1',
      'plant-2',
      'plant-3',
    ]);
    const validation = validatePlan(next);
    expect([...validation.overlappingIds].sort()).toEqual([
      'plant-1',
      'plant-2',
    ]);
    expect([...validation.outsideIds]).toEqual(['plant-3']);
  });

  it('creates a primary flowerbed instead of exposing an outer property layer', () => {
    const created = createEditorDocument(null, 400, 250);

    expect(created.flowerbeds).toHaveLength(1);
    expect(created.flowerbeds[0]).toMatchObject({
      xCm: 0,
      yCm: 0,
      widthCm: 400,
      heightCm: 250,
    });
    expect(created.flowerbeds[0]?.boundaryPoints).toEqual(
      created.propertyBoundaryPoints,
    );
  });

  it('validates placements against flowerbeds without using the outer boundary', () => {
    const withoutFlowerbeds: PlanEditorDocument = {
      ...document,
      flowerbeds: [],
      placements: [
        {
          ...document.placements[0]!,
          flowerbedId: null,
          xCm: 150,
          yCm: 100,
        },
      ],
    };

    expect([...validatePlan(withoutFlowerbeds).outsideIds]).toEqual([
      'plant-1',
    ]);

    const withUnrelatedOuterBoundary: PlanEditorDocument = {
      ...document,
      propertyBoundaryPoints: [
        { xCm: 0, yCm: 0 },
        { xCm: 10, yCm: 0 },
        { xCm: 10, yCm: 10 },
        { xCm: 0, yCm: 10 },
      ],
    };
    expect([...validatePlan(withUnrelatedOuterBoundary).outsideIds]).toEqual(
      [],
    );
  });

  it('samples and preserves the four supported edge kinds', () => {
    const curved = [
      {
        xCm: 0,
        yCm: 0,
        edgeKind: 'bezier' as const,
        edgeCurvature: 0.3,
      },
      { xCm: 100, yCm: 0 },
      { xCm: 100, yCm: 100 },
      { xCm: 0, yCm: 100 },
    ];

    expect(edgePointAt(curved[0]!, curved[1]!, 0.5).yCm).toBeGreaterThan(0);
    expect(sampleBoundary(curved)).toHaveLength(96);
    expect(boundaryPathData(curved)).toContain('Z');
    const split = insertPointAfter(curved, 0);
    expect(split).toHaveLength(5);
    expect(split[1]).toMatchObject({
      edgeKind: 'bezier',
      edgeCurvature: 0.3,
    });
  });

  it('nudges a multi-selection in domain coordinates', () => {
    const next = moveObjects(
      document,
      ['flowerbed:bed-1', 'plant:plant-1'],
      5,
      -10,
    );

    expect(next.flowerbeds[0]).toMatchObject({ xCm: 25, yCm: 10 });
    expect(next.flowerbeds[0]?.boundaryPoints[0]).toEqual({
      xCm: 25,
      yCm: 10,
    });
    expect(next.placements[0]).toMatchObject({ xCm: 85, yCm: 70 });
  });
});
