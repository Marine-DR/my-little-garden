export const APPLICATION_CHANNELS = {
  version: 'application:version',
} as const;

export interface ApplicationService {
  getVersion(): Promise<string>;
}
