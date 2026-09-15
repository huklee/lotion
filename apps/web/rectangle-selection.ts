export type SelectionRectangle = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function rectangleFromPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
): SelectionRectangle {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(start.x - end.x),
    h: Math.abs(start.y - end.y),
  };
}

export function rectanglesIntersect(
  a: SelectionRectangle,
  b: SelectionRectangle,
): boolean {
  return (
    a.y + a.h > b.y && a.y < b.y + b.h && a.x + a.w > b.x && a.x < b.x + b.w
  );
}

export function sameSelection(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
