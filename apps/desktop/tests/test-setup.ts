import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

const canvasContexts = new WeakMap<
  HTMLCanvasElement,
  CanvasRenderingContext2D
>();

function createCanvasContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
  const methods: Partial<CanvasRenderingContext2D> = {
    canvas,
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    createPattern: vi.fn(() => ({}) as CanvasPattern),
    getImageData: vi.fn(
      (_x, _y, width, height) =>
        ({
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height,
          colorSpace: 'srgb',
        }) as ImageData,
    ),
    getLineDash: vi.fn(() => []),
    isPointInPath: vi.fn(() => false),
    isPointInStroke: vi.fn(() => false),
    measureText: vi.fn(
      (text) =>
        ({
          width: String(text).length * 8,
          actualBoundingBoxAscent: 8,
          actualBoundingBoxDescent: 2,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: String(text).length * 8,
        }) as TextMetrics,
    ),
  };

  return new Proxy(methods, {
    get(target, property, receiver) {
      const existing = Reflect.get(target, property, receiver);
      if (existing !== undefined) {
        return existing;
      }
      const method = vi.fn();
      Reflect.set(target, property, method, receiver);
      return method;
    },
  }) as CanvasRenderingContext2D;
}

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(function (this: HTMLCanvasElement, contextId: string) {
      if (contextId !== '2d') {
        return null;
      }
      const existing = canvasContexts.get(this);
      if (existing) {
        return existing;
      }
      const context = createCanvasContext(this);
      canvasContexts.set(this, context);
      return context;
    }),
  });
}
