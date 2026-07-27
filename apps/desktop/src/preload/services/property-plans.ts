import type { IpcRenderer } from 'electron';
import {
  PROPERTY_PLAN_CHANNELS,
  type PropertyPlanService,
} from '../../shared/property-plan-service.js';

export function createPropertyPlanService(
  ipcRenderer: Pick<IpcRenderer, 'invoke'>,
): PropertyPlanService {
  return {
    listPropertyPlans: () => ipcRenderer.invoke(PROPERTY_PLAN_CHANNELS.list),
    getPropertyPlan: (propertyPlanId) =>
      ipcRenderer.invoke(PROPERTY_PLAN_CHANNELS.get, propertyPlanId),
    savePropertyPlan: (input) =>
      ipcRenderer.invoke(PROPERTY_PLAN_CHANNELS.save, input),
    deletePropertyPlan: (propertyPlanId) =>
      ipcRenderer.invoke(PROPERTY_PLAN_CHANNELS.delete, propertyPlanId),
  };
}
