import { describe, expect, it } from "vitest";
import {
  resizeFloorPlanRect,
  viewportToCanvasPoint,
  type FloorPlanRect,
  type FloorPlanResizeHandle,
} from "./floorPlanGeometry";

describe("viewportToCanvasPoint", () => {
  it("keeps coordinates unchanged at 100% without panning", () => {
    expect(
      viewportToCanvasPoint({ x: 350, y: 220 }, { x: 0, y: 0 }, 1)
    ).toEqual({ x: 350, y: 220 });
  });

  it("inverts 150% zoom", () => {
    expect(
      viewportToCanvasPoint({ x: 525, y: 330 }, { x: 0, y: 0 }, 1.5)
    ).toEqual({ x: 350, y: 220 });
  });

  it("inverts panning and zoom together", () => {
    expect(
      viewportToCanvasPoint({ x: 565, y: 300 }, { x: 40, y: -30 }, 1.5)
    ).toEqual({ x: 350, y: 220 });
  });

  it("uses a safe fallback for an invalid zoom", () => {
    expect(
      viewportToCanvasPoint({ x: 90, y: 70 }, { x: 10, y: 20 }, 0)
    ).toEqual({ x: 80, y: 50 });
  });
});

describe("resizeFloorPlanRect", () => {
  const drawWidth = 620;
  const drawHeight = 400;
  const rect: FloorPlanRect = {
    xPct: 30,
    yPct: 35,
    widthPct: 20,
    heightPct: 10,
  };
  const handles: FloorPlanResizeHandle[] = [
    "nw",
    "n",
    "ne",
    "e",
    "se",
    "s",
    "sw",
    "w",
  ];

  function anchorPoint(
    value: FloorPlanRect,
    handle: FloorPlanResizeHandle,
    rotationDeg: number
  ) {
    const movesE = handle === "ne" || handle === "e" || handle === "se";
    const movesW = handle === "nw" || handle === "w" || handle === "sw";
    const movesN = handle === "nw" || handle === "n" || handle === "ne";
    const movesS = handle === "sw" || handle === "s" || handle === "se";
    const width = (value.widthPct / 100) * drawWidth;
    const height = (value.heightPct / 100) * drawHeight;
    const centerX = ((value.xPct + value.widthPct / 2) / 100) * drawWidth;
    const centerY = ((value.yPct + value.heightPct / 2) / 100) * drawHeight;
    const localX = movesE ? -width / 2 : movesW ? width / 2 : 0;
    const localY = movesS ? -height / 2 : movesN ? height / 2 : 0;
    const theta = (rotationDeg * Math.PI) / 180;
    return {
      x: centerX + localX * Math.cos(theta) - localY * Math.sin(theta),
      y: centerY + localX * Math.sin(theta) + localY * Math.cos(theta),
    };
  }

  it.each([0, 90, 180, 270])(
    "keeps the opposite anchor fixed for all eight handles at %d°",
    rotationDeg => {
      handles.forEach(handle => {
        const before = anchorPoint(rect, handle, rotationDeg);
        const resized = resizeFloorPlanRect({
          rect,
          handle,
          delta: { x: 31, y: 24 },
          rotationDeg,
          drawWidth,
          drawHeight,
          stepXPct: 0,
          stepYPct: 0,
          minSizePct: 1.5,
        });
        const after = anchorPoint(resized, handle, rotationDeg);
        expect(after.x).toBeCloseTo(before.x, 8);
        expect(after.y).toBeCloseTo(before.y, 8);
      });
    }
  );

  it("changes only width for east/west handles and only height for north/south handles", () => {
    (["e", "w"] as const).forEach(handle => {
      const resized = resizeFloorPlanRect({
        rect,
        handle,
        delta: { x: 30, y: 20 },
        rotationDeg: 0,
        drawWidth,
        drawHeight,
        stepXPct: 0,
        stepYPct: 0,
        minSizePct: 1.5,
      });
      expect(resized.heightPct).toBe(rect.heightPct);
    });
    (["n", "s"] as const).forEach(handle => {
      const resized = resizeFloorPlanRect({
        rect,
        handle,
        delta: { x: 30, y: 20 },
        rotationDeg: 0,
        drawWidth,
        drawHeight,
        stepXPct: 0,
        stepYPct: 0,
        minSizePct: 1.5,
      });
      expect(resized.widthPct).toBe(rect.widthPct);
    });
  });

  it("uses SVG-axis scale for a rotated object in a non-square room", () => {
    const resized = resizeFloorPlanRect({
      rect,
      handle: "e",
      delta: { x: 0, y: 62 },
      rotationDeg: 90,
      drawWidth,
      drawHeight,
      stepXPct: 0,
      stepYPct: 0,
      minSizePct: 1.5,
    });
    expect(resized.widthPct).toBeCloseTo(30, 8);
    expect(resized.heightPct).toBe(rect.heightPct);
  });
});
