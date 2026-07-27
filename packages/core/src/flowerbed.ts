export interface FlowerbedZone {
  readonly id: string;
  readonly xCm: number;
  readonly yCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly boundaryPoints: readonly FlowerbedBoundaryPoint[];
}

export interface FlowerbedBoundaryPoint {
  readonly xCm: number;
  readonly yCm: number;
}

export interface FlowerbedPlantPlacement {
  readonly id: string;
  readonly zoneId: string | null;
  readonly plantId: string | null;
  readonly plantNameSnapshot: string;
  readonly spacingCmSnapshot: number;
  readonly colorSnapshot: string | null;
  readonly xCm: number;
  readonly yCm: number;
}

export interface FlowerbedSummary {
  readonly id: string;
  readonly name: string;
  readonly selectionId: string | null;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly zoneCount: number;
  readonly placementCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FlowerbedDesign extends FlowerbedSummary {
  readonly boundaryPoints: readonly FlowerbedBoundaryPoint[];
  readonly zones: readonly FlowerbedZone[];
  readonly placements: readonly FlowerbedPlantPlacement[];
}

export interface FlowerbedZoneInput {
  readonly id?: string;
  readonly xCm: number;
  readonly yCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly boundaryPoints?: readonly FlowerbedBoundaryPoint[];
}

export interface FlowerbedPlantPlacementInput {
  readonly id?: string;
  readonly zoneId: string | null;
  readonly plantId: string | null;
  readonly plantNameSnapshot: string;
  readonly spacingCmSnapshot: number;
  readonly colorSnapshot: string | null;
  readonly xCm: number;
  readonly yCm: number;
}

export interface FlowerbedSaveInput {
  readonly id?: string;
  readonly name: string;
  readonly selectionId: string | null;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly boundaryPoints?: readonly FlowerbedBoundaryPoint[];
  readonly zones: readonly FlowerbedZoneInput[];
  readonly placements: readonly FlowerbedPlantPlacementInput[];
}
