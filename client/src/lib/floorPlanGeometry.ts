export type FloorPlanPoint = {
  x: number;
  y: number;
};

export function viewportToCanvasPoint(
  point: FloorPlanPoint,
  pan: FloorPlanPoint,
  zoom: number,
): FloorPlanPoint {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return {
    x: (point.x - pan.x) / safeZoom,
    y: (point.y - pan.y) / safeZoom,
  };
}
