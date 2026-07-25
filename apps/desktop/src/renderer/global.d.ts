import type { CatalogManagementService } from '../shared/catalog-management-service';
import type { CatalogService } from '../shared/catalog-service';
import type { PhotoService } from '../shared/photo-service';
import type { SelectionService } from '../shared/selection-service';
import type { PropertyPlanService } from '../shared/property-plan-service';

declare global {
  interface Window {
    catalogService: CatalogService;
    selectionService: SelectionService;
    catalogManagementService: CatalogManagementService;
    photoService: PhotoService;
    propertyPlanService: PropertyPlanService;
  }
}

export {};
