export const ABOUT_CHANNELS = {
  get: 'about:get',
} as const;

export interface About {
  version: string;
}

export interface AboutService {
  getAbout(): Promise<About>;
}
