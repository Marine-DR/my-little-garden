import type {
  PropertyPlanRepository,
  PropertyPlanSaveInput,
} from '@my-little-garden/core';
import type { IpcMain } from 'electron';
import { PROPERTY_PLAN_CHANNELS } from '../../shared/property-plan-service.js';

export function registerPropertyPlanHandlers(
  ipcMain: IpcMain,
  propertyPlanRepository: PropertyPlanRepository,
): void {
  ipcMain.handle(PROPERTY_PLAN_CHANNELS.list, () =>
    propertyPlanRepository.list(),
  );
  ipcMain.handle(PROPERTY_PLAN_CHANNELS.get, (_event, propertyPlanId: string) =>
    propertyPlanRepository.get(propertyPlanId),
  );
  ipcMain.handle(
    PROPERTY_PLAN_CHANNELS.save,
    (_event, input: PropertyPlanSaveInput) =>
      propertyPlanRepository.save(input),
  );
  ipcMain.handle(
    PROPERTY_PLAN_CHANNELS.delete,
    (_event, propertyPlanId: string) =>
      propertyPlanRepository.delete(propertyPlanId),
  );
}
