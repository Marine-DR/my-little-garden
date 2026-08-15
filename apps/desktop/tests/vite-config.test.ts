// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { UserConfig } from 'vite';
import viteConfig from '../../../vite.config';

describe('renderer Vite configuration', () => {
  it('serves the core source barrel as ESM during development', () => {
    const aliases = (viteConfig as UserConfig).resolve?.alias as Record<
      string,
      string
    >;

    expect(aliases['@my-little-garden/core']).toBe(
      resolve(process.cwd(), 'packages/core/src/index.ts'),
    );
  });
});
