export type BoundaryEdgeKind =
  'line' | 'circular-arc' | 'elliptical-arc' | 'bezier';

export interface PropertyBoundaryPoint {
  readonly xCm: number;
  readonly yCm: number;
  readonly edgeKind?: BoundaryEdgeKind;
  readonly edgeCurvature?: number;
}

export interface Flowerbed {
  readonly id: string;
  readonly xCm: number;
  readonly yCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly boundaryPoints: readonly PropertyBoundaryPoint[];
}

export interface PropertyPlanPlantPlacement {
  readonly id: string;
  readonly flowerbedId: string | null;
  readonly plantId: string | null;
  readonly plantNameSnapshot: string;
  readonly spacingCmSnapshot: number;
  readonly colorSnapshot: string | null;
  readonly xCm: number;
  readonly yCm: number;
}

export interface PropertyPlanSummary {
  readonly id: string;
  readonly name: string;
  readonly selectionId: string | null;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly flowerbedCount: number;
  readonly placementCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PropertyPlanDesign extends PropertyPlanSummary {
  readonly propertyBoundaryPoints: readonly PropertyBoundaryPoint[];
  readonly flowerbeds: readonly Flowerbed[];
  readonly placements: readonly PropertyPlanPlantPlacement[];
}

export interface FlowerbedInput {
  readonly id?: string;
  readonly xCm: number;
  readonly yCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly boundaryPoints?: readonly PropertyBoundaryPoint[];
}

export interface PropertyPlanPlantPlacementInput {
  readonly id?: string;
  readonly flowerbedId: string | null;
  readonly plantId: string | null;
  readonly plantNameSnapshot: string;
  readonly spacingCmSnapshot: number;
  readonly colorSnapshot: string | null;
  readonly xCm: number;
  readonly yCm: number;
}

export interface PropertyPlanSaveInput {
  readonly id?: string;
  readonly name: string;
  readonly selectionId: string | null;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly propertyBoundaryPoints?: readonly PropertyBoundaryPoint[];
  readonly flowerbeds: readonly FlowerbedInput[];
  readonly placements: readonly PropertyPlanPlantPlacementInput[];
}
