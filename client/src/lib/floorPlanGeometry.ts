export type FloorPlanPoint = {
  x: number;
  y: number;
};

export type FloorPlanResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

export type FloorPlanRect = {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
};

export function viewportToCanvasPoint(
  point: FloorPlanPoint,
  pan: FloorPlanPoint,
  zoom: number
): FloorPlanPoint {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return {
    x: (point.x - pan.x) / safeZoom,
    y: (point.y - pan.y) / safeZoom,
  };
}

type ResizeFloorPlanRectOptions = {
  rect: FloorPlanRect;
  handle: FloorPlanResizeHandle;
  delta: FloorPlanPoint;
  rotationDeg: number;
  drawWidth: number;
  drawHeight: number;
  stepXPct: number;
  stepYPct: number;
  minSizePct: number;
};

function snapTo(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Resizes a rotated floor-plan rectangle while keeping the side/corner
 * opposite the dragged handle fixed on screen.
 *
 * Pointer and rotation calculations deliberately happen in SVG units. X and Y
 * percentages use different scales in a rectangular room, so rotating a
 * percentage-space delta would make the object drift.
 */
export function resizeFloorPlanRect({
  rect,
  handle,
  delta,
  rotationDeg,
  drawWidth,
  drawHeight,
  stepXPct,
  stepYPct,
  minSizePct,
}: ResizeFloorPlanRectOptions): FloorPlanRect {
  if (drawWidth <= 0 || drawHeight <= 0) return rect;

  const movesE = handle === "ne" || handle === "e" || handle === "se";
  const movesW = handle === "nw" || handle === "w" || handle === "sw";
  const movesN = handle === "nw" || handle === "n" || handle === "ne";
  const movesS = handle === "sw" || handle === "s" || handle === "se";

  const theta = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const localDx = delta.x * cos + delta.y * sin;
  const localDy = -delta.x * sin + delta.y * cos;

  let widthPct = rect.widthPct;
  let heightPct = rect.heightPct;

  if (movesE) widthPct += (localDx / drawWidth) * 100;
  else if (movesW) widthPct -= (localDx / drawWidth) * 100;
  if (movesS) heightPct += (localDy / drawHeight) * 100;
  else if (movesN) heightPct -= (localDy / drawHeight) * 100;

  if (movesE || movesW) {
    widthPct = clamp(
      snapTo(Math.max(minSizePct, widthPct), stepXPct),
      minSizePct,
      100
    );
  }
  if (movesN || movesS) {
    heightPct = clamp(
      snapTo(Math.max(minSizePct, heightPct), stepYPct),
      minSizePct,
      100
    );
  }

  const width0 = (rect.widthPct / 100) * drawWidth;
  const height0 = (rect.heightPct / 100) * drawHeight;
  const width1 = (widthPct / 100) * drawWidth;
  const height1 = (heightPct / 100) * drawHeight;
  const centerX0 = ((rect.xPct + rect.widthPct / 2) / 100) * drawWidth;
  const centerY0 = ((rect.yPct + rect.heightPct / 2) / 100) * drawHeight;

  const anchorX0 = movesE ? -width0 / 2 : movesW ? width0 / 2 : 0;
  const anchorY0 = movesS ? -height0 / 2 : movesN ? height0 / 2 : 0;
  const anchorX1 = movesE ? -width1 / 2 : movesW ? width1 / 2 : 0;
  const anchorY1 = movesS ? -height1 / 2 : movesN ? height1 / 2 : 0;

  const fixedX = centerX0 + anchorX0 * cos - anchorY0 * sin;
  const fixedY = centerY0 + anchorX0 * sin + anchorY0 * cos;
  const centerX1 = fixedX - (anchorX1 * cos - anchorY1 * sin);
  const centerY1 = fixedY - (anchorX1 * sin + anchorY1 * cos);

  return {
    xPct: clamp(((centerX1 - width1 / 2) / drawWidth) * 100, 0, 100 - widthPct),
    yPct: clamp(
      ((centerY1 - height1 / 2) / drawHeight) * 100,
      0,
      100 - heightPct
    ),
    widthPct,
    heightPct,
  };
}
