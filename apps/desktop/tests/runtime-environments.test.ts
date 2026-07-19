// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { configureRuntimeEnvironment } from '../src/main/runtime-environments/index';

describe('configureRuntimeEnvironment', () => {
  it('disables hardware acceleration for a Linux Wayland session', () => {
    const disableHardwareAcceleration = vi.fn();

    configureRuntimeEnvironment(
      { disableHardwareAcceleration },
      { platform: 'linux', sessionType: 'wayland' },
    );

    expect(disableHardwareAcceleration).toHaveBeenCalledOnce();
  });

  it('keeps hardware acceleration for a Linux X11 session', () => {
    const disableHardwareAcceleration = vi.fn();

    configureRuntimeEnvironment(
      { disableHardwareAcceleration },
      { platform: 'linux', sessionType: 'x11' },
    );

    expect(disableHardwareAcceleration).not.toHaveBeenCalled();
  });

  it('keeps hardware acceleration outside Linux', () => {
    const disableHardwareAcceleration = vi.fn();

    configureRuntimeEnvironment(
      { disableHardwareAcceleration },
      { platform: 'darwin', sessionType: 'wayland' },
    );

    expect(disableHardwareAcceleration).not.toHaveBeenCalled();
  });
});
