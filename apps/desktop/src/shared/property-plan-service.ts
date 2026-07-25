import type {
  PropertyPlanDesign,
  PropertyPlanSaveInput,
  PropertyPlanSummary,
} from '@my-little-garden/core';

export const PROPERTY_PLAN_CHANNELS = {
  list: 'property-plans:list',
  get: 'property-plans:get',
  save: 'property-plans:save',
  delete: 'property-plans:delete',
} as const;

export interface PropertyPlanService {
  listPropertyPlans(): Promise<readonly PropertyPlanSummary[]>;
  getPropertyPlan(propertyPlanId: string): Promise<PropertyPlanDesign | null>;
  savePropertyPlan(input: PropertyPlanSaveInput): Promise<PropertyPlanDesign>;
  deletePropertyPlan(propertyPlanId: string): Promise<boolean>;
}
