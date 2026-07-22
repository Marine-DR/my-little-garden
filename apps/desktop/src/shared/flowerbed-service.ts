import type {
  FlowerbedDesign,
  FlowerbedSaveInput,
  FlowerbedSummary,
} from '@my-little-garden/core';

export const FLOWERBED_CHANNELS = {
  list: 'flowerbeds:list',
  get: 'flowerbeds:get',
  save: 'flowerbeds:save',
  delete: 'flowerbeds:delete',
} as const;

export interface FlowerbedService {
  listFlowerbeds(): Promise<readonly FlowerbedSummary[]>;
  getFlowerbed(flowerbedId: string): Promise<FlowerbedDesign | null>;
  saveFlowerbed(input: FlowerbedSaveInput): Promise<FlowerbedDesign>;
  deleteFlowerbed(flowerbedId: string): Promise<boolean>;
}
