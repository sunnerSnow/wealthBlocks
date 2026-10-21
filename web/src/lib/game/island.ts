/** 島嶼格線 9×9；L 是陸地，其他是水（與設計原型 design/kids-prototype.html 相同） */
export const GRID_SIZE = 9;
export const ISLAND_MASK = [
  "...LLL...",
  ".LLLLLL..",
  ".LLLLLLL.",
  "LLLLLLLLL",
  "LLLLLLLLL",
  "LLLLLLLL.",
  ".LLLLLLL.",
  "..LLLLL..",
  "...LL....",
] as const;

export function isLand(x: number, y: number): boolean {
  return y >= 0 && y < GRID_SIZE && x >= 0 && x < GRID_SIZE && ISLAND_MASK[y][x] === "L";
}

export interface Footprint {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function overlaps(a: Footprint, b: Footprint): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export type PlacementCheck = { ok: true } | { ok: false; reason: "outside" } | { ok: false; reason: "overlap"; withId: string };

/** 放置規則：每一格都要在陸地上，而且不能和其他物件重疊（ignoreId 是正在移動的那一個） */
export function checkPlacement(candidate: Footprint, placed: (Footprint & { id: string })[], ignoreId?: string): PlacementCheck {
  if (!Number.isInteger(candidate.x) || !Number.isInteger(candidate.y)) return { ok: false, reason: "outside" };
  for (let dy = 0; dy < candidate.height; dy++) {
    for (let dx = 0; dx < candidate.width; dx++) {
      if (!isLand(candidate.x + dx, candidate.y + dy)) return { ok: false, reason: "outside" };
    }
  }
  const hit = placed.find((p) => p.id !== ignoreId && overlaps(candidate, p));
  return hit ? { ok: false, reason: "overlap", withId: hit.id } : { ok: true };
}
