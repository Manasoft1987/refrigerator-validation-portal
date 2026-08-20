import { describe, expect, it } from "vitest";
import { reeferHeatPoint } from "./charts";

describe("reefer temperature map coordinates", () => {
  it("keeps the front/cabin side on the right, matching the 3D placement diagram", () => {
    const frontLower = reeferHeatPoint({ label: "front", role: "internal", position: "C1" } as any, 0);
    const rearLower = reeferHeatPoint({ label: "rear", role: "internal", position: "C4" } as any, 1);

    expect(frontLower.x).toBeGreaterThan(rearLower.x);
  });
});
