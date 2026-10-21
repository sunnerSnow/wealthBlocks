import { memo, type CSSProperties } from "react";
import { C } from "@/components/art/assets";
import { GRID_SIZE, isLand } from "@/lib/game/island";

/** 陸地格：四個角依鄰格是不是水決定要不要圓角，下緣是水的格子畫出積木底板的側面 */
export const Cells = memo(function Cells() {
  const cells = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!isLand(x, y)) {
        cells.push(<i key={`${x}-${y}`} className="cell" />);
        continue;
      }
      const cls = ["cell", "l"];
      if (!isLand(x - 1, y) && !isLand(x, y - 1)) cls.push("tl");
      if (!isLand(x + 1, y) && !isLand(x, y - 1)) cls.push("tr");
      if (!isLand(x - 1, y) && !isLand(x, y + 1)) cls.push("bl");
      if (!isLand(x + 1, y) && !isLand(x, y + 1)) cls.push("br");
      if (!isLand(x, y + 1)) cls.push("eb");
      cells.push(<i key={`${x}-${y}`} className={cls.join(" ")} />);
    }
  }
  return (
    <div className="cells" aria-hidden="true">
      {cells}
    </div>
  );
});

function Wave({ style }: { style: CSSProperties }) {
  return (
    <svg className="wave" style={style} viewBox="0 0 40 14" aria-hidden="true">
      <path d="M2 9q5-6 10 0t10 0 10 0" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** 水面上的浪花與小船（純裝飾） */
export function Water() {
  return (
    <>
      <Wave style={{ left: "76%", top: "6%" }} />
      <Wave style={{ left: "4%", top: "28%" }} />
      <Wave style={{ left: "86%", top: "57%" }} />
      <svg className="boat" style={{ left: "6%", top: "78%" }} viewBox="0 0 40 36" aria-hidden="true">
        <path d="M20 4v22" stroke={C.navy} strokeWidth="2" />
        <path d="M21 5l12 17H21Z" fill={C.yel} />
        <path d="M19 9l-9 13h9Z" fill="#fff" />
        <path d="M5 25h30l-5 8H10Z" fill={C.coral} />
        <path d="M8 29h24" stroke={C.coralD} strokeWidth="2" />
      </svg>
    </>
  );
}
