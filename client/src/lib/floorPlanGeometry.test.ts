import { describe, expect, it } from "vitest";
import { viewportToCanvasPoint } from "./floorPlanGeometry";

describe("viewportToCanvasPoint", () => {
  it("keeps coordinates unchanged at 100% without panning", () => {
    expect(viewportToCanvasPoint({ x: 350, y: 220 }, { x: 0, y: 0 }, 1))
      .toEqual({ x: 350, y: 220 });
  });

  it("inverts 150% zoom", () => {
    expect(viewportToCanvasPoint({ x: 525, y: 330 }, { x: 0, y: 0 }, 1.5))
      .toEqual({ x: 350, y: 220 });
  });

  it("inverts panning and zoom together", () => {
    expect(viewportToCanvasPoint({ x: 565, y: 300 }, { x: 40, y: -30 }, 1.5))
      .toEqual({ x: 350, y: 220 });
  });

  it("uses a safe fallback for an invalid zoom", () => {
    expect(viewportToCanvasPoint({ x: 90, y: 70 }, { x: 10, y: 20 }, 0))
      .toEqual({ x: 80, y: 50 });
  });
});
