import type { CSSProperties } from "react";
import { getArt } from "@/components/art/assets";
import { GRID_SIZE } from "@/lib/game/island";

const pct = (n: number) => `${(n / GRID_SIZE) * 100}%`;

export interface Placed {
  assetKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isFlat: boolean;
}

/** 物件底部對齊佔地格，往上延伸到素材高度；越下面的列畫在越上層，平面的地形永遠在最底層 */
export function objectStyle(o: Placed): CSSProperties {
  const [, vh] = getArt(o.assetKey);
  return {
    left: pct(o.x),
    bottom: pct(GRID_SIZE - (o.y + o.height)),
    width: pct(o.width),
    height: pct(vh / 40),
    zIndex: o.isFlat ? 1 : (o.y + o.height) * 10 + o.x,
  };
}

/** 佔地格的範圍（放置預覽的綠框／紅框） */
export function footprintStyle(o: { x: number; y: number; width: number; height: number }): CSSProperties {
  return { left: pct(o.x), top: pct(o.y), width: pct(o.width), height: pct(o.height) };
}
