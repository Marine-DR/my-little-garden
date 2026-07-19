import type { App } from 'electron';
import { configureLinuxRuntime } from './linux.js';

interface RuntimeEnvironment {
  readonly platform: NodeJS.Platform;
  readonly sessionType: string | undefined;
}

export function configureRuntimeEnvironment(
  app: Pick<App, 'disableHardwareAcceleration'>,
  environment: RuntimeEnvironment = {
    platform: process.platform,
    sessionType: process.env.XDG_SESSION_TYPE,
  },
): void {
  if (environment.platform === 'linux') {
    configureLinuxRuntime(app, environment.sessionType);
  }
}
