export interface RectangleCm {
  readonly xCm: number;
  readonly yCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
}

export interface CircleCm {
  readonly xCm: number;
  readonly yCm: number;
  readonly radiusCm: number;
}

export function rectangleContainsRectangle(
  outer: RectangleCm,
  inner: RectangleCm,
): boolean {
  return (
    inner.xCm >= outer.xCm &&
    inner.yCm >= outer.yCm &&
    inner.xCm + inner.widthCm <= outer.xCm + outer.widthCm &&
    inner.yCm + inner.heightCm <= outer.yCm + outer.heightCm
  );
}

export function rectangleContainsCircle(
  rectangle: RectangleCm,
  circle: CircleCm,
): boolean {
  return (
    circle.xCm - circle.radiusCm >= rectangle.xCm &&
    circle.yCm - circle.radiusCm >= rectangle.yCm &&
    circle.xCm + circle.radiusCm <= rectangle.xCm + rectangle.widthCm &&
    circle.yCm + circle.radiusCm <= rectangle.yCm + rectangle.heightCm
  );
}

export function circlesOverlap(first: CircleCm, second: CircleCm): boolean {
  const xDistance = first.xCm - second.xCm;
  const yDistance = first.yCm - second.yCm;
  const combinedRadius = first.radiusCm + second.radiusCm;
  return xDistance * xDistance + yDistance * yDistance < combinedRadius ** 2;
}

export function clampPointToRectangle(
  point: Pick<CircleCm, 'xCm' | 'yCm'>,
  rectangle: RectangleCm,
): Pick<CircleCm, 'xCm' | 'yCm'> {
  return {
    xCm: Math.min(
      rectangle.xCm + rectangle.widthCm,
      Math.max(rectangle.xCm, point.xCm),
    ),
    yCm: Math.min(
      rectangle.yCm + rectangle.heightCm,
      Math.max(rectangle.yCm, point.yCm),
    ),
  };
}
