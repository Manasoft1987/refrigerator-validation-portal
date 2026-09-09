import { describe, expect, it } from "vitest";
import {
  canonicalRefrigeratorPlacements,
  refrigeratorPlacementCode,
} from "../shared/refrigeratorPlacement";

describe("canonical refrigerator placements", () => {
  it("keeps colliding logger positions visible instead of overwriting one", () => {
    const sensors = [
      { id: 1, role: "internal", position: "RF:S1:BL" },
      { id: 2, role: "internal", position: "RF:S1:BL" },
      { id: 3, role: "internal", position: "RF:S1:BR" },
    ];

    const placements = canonicalRefrigeratorPlacements(sensors, 5);
    const assigned = Array.from(placements.values());

    expect(assigned).toHaveLength(3);
    expect(new Set(assigned.map(entry => refrigeratorPlacementCode(entry.placement))).size).toBe(3);
    expect(assigned.map(entry => entry.sensor.id)).toEqual([1, 2, 3]);
  });
});
