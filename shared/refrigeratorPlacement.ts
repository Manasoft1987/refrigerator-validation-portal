export type RefrigeratorZoneCode = "BL" | "BC" | "BR" | "FL" | "FC" | "FR";

export type RefrigeratorPlacement = {
  shelf: number;
  zone: RefrigeratorZoneCode;
};

export const REFRIGERATOR_ZONES: Array<{ code: RefrigeratorZoneCode; x: number; depth: number }> = [
  { code: "BL", x: 14, depth: 20 },
  { code: "BC", x: 50, depth: 20 },
  { code: "BR", x: 86, depth: 20 },
  { code: "FL", x: 14, depth: 84 },
  { code: "FC", x: 50, depth: 84 },
  { code: "FR", x: 86, depth: 84 },
];

const ZONE_ORDER = REFRIGERATOR_ZONES.map(zone => zone.code);

export function parseRefrigeratorPlacement(position: string | null | undefined): RefrigeratorPlacement | null {
  const match = String(position || "").match(/^RF:S(\d+):(BL|BC|BR|FL|FC|FR)$/);
  if (!match) return null;
  return { shelf: Math.max(1, Number(match[1])), zone: match[2] as RefrigeratorZoneCode };
}

export function refrigeratorPlacementCode(placement: RefrigeratorPlacement): string {
  return `RF:S${placement.shelf}:${placement.zone}`;
}

function clampShelf(shelf: number, shelfCount: number): number {
  return Math.max(1, Math.min(shelfCount, Math.round(shelf)));
}

function legacyRefrigeratorPlacement(
  sensor: { position?: string | null; posX?: number | string | null; posY?: number | string | null },
  index: number,
  shelfCount: number,
): RefrigeratorPlacement {
  if (sensor.position === "top") return { shelf: 1, zone: "FC" };
  if (sensor.position === "middle") return { shelf: clampShelf(Math.ceil(shelfCount / 2), shelfCount), zone: "FC" };
  if (sensor.position === "bottom") return { shelf: shelfCount, zone: "FC" };
  if (sensor.position === "door") return { shelf: clampShelf(Math.ceil(shelfCount / 2), shelfCount), zone: "FR" };

  if (sensor.posX != null && sensor.posY != null) {
    const x = Number(sensor.posX);
    const y = Number(sensor.posY);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const shelf = clampShelf((y / 100) * Math.max(1, shelfCount - 1) + 1, shelfCount);
      const zone: RefrigeratorZoneCode = x < 33 ? "FL" : x > 66 ? "FR" : "FC";
      return { shelf, zone };
    }
  }

  const fallbackZones: RefrigeratorZoneCode[] = ["FL", "FR", "BC"];
  return {
    shelf: clampShelf(1 + Math.floor(index / fallbackZones.length), shelfCount),
    zone: fallbackZones[index % fallbackZones.length],
  };
}

/**
 * Returns a collision-free, deterministic placement map for every internal sensor.
 * Explicit RF positions are preferred; legacy coordinates and a stable fallback
 * are used for older/imported records. A duplicate position is moved to the first
 * free slot instead of being silently overwritten by a Map.
 */
export function canonicalRefrigeratorPlacements<T extends { id: number; role?: string; position?: string | null; posX?: number | string | null; posY?: number | string | null }>(
  sensors: T[],
  shelfCount: number,
): Map<string, { sensor: T; placement: RefrigeratorPlacement; index: number }> {
  const internals = sensors.filter(sensor => sensor.role === undefined || sensor.role === "internal");
  const normalizedShelfCount = Math.max(3, Math.min(9, Math.round(shelfCount)));
  const slots = Array.from({ length: normalizedShelfCount }, (_, shelfIndex) =>
    ZONE_ORDER.map(zone => ({ shelf: shelfIndex + 1, zone })),
  ).flat();
  const used = new Set<string>();
  const result = new Map<string, { sensor: T; placement: RefrigeratorPlacement; index: number }>();

  internals.forEach((sensor, index) => {
    const parsed = parseRefrigeratorPlacement(sensor.position);
    const preferred = parsed
      ? { shelf: clampShelf(parsed.shelf, normalizedShelfCount), zone: parsed.zone }
      : legacyRefrigeratorPlacement(sensor, index, normalizedShelfCount);
    const preferredCode = refrigeratorPlacementCode(preferred);
    const placement = used.has(preferredCode)
      ? (slots.find(slot => !used.has(refrigeratorPlacementCode(slot))) ?? preferred)
      : preferred;
    const code = refrigeratorPlacementCode(placement);
    used.add(code);
    result.set(code, { sensor, placement, index });
  });

  return result;
}

export function canonicalRefrigeratorPlacementForSensor<T extends { id: number; role?: string; position?: string | null; posX?: number | string | null; posY?: number | string | null }>(
  sensors: T[],
  sensor: T,
  shelfCount: number,
): RefrigeratorPlacement | null {
  for (const { sensor: mappedSensor, placement } of canonicalRefrigeratorPlacements(sensors, shelfCount).values()) {
    if (mappedSensor.id === sensor.id) return placement;
  }
  return null;
}
