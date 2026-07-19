interface HardwareAccelerationApp {
  disableHardwareAcceleration(): void;
}

export function configureLinuxRuntime(
  app: HardwareAccelerationApp,
  sessionType: string | undefined,
): void {
  // Electron 42 can select native Wayland together with Vulkan and report
  // `--ozone-platform=wayland is not compatible with Vulkan` at startup.
  if (sessionType?.toLowerCase() === 'wayland') {
    app.disableHardwareAcceleration();
  }
}
