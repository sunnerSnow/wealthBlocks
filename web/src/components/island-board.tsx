import type { CSSProperties } from "react";
import { C, getArt } from "@/components/art/assets";
import { BlockArt } from "@/components/art/block-art";
import { GRID_SIZE, isLand } from "@/lib/game/island";
import type { IslandObjectDto } from "@/lib/services/game";

const pct = (n: number) => `${(n / GRID_SIZE) * 100}%`;

/** 物件底部對齊佔地格，往上延伸到素材高度；越下面的列畫在越上層 */
function objectStyle(o: IslandObjectDto): CSSProperties {
  const [, vh] = getArt(o.assetKey);
  return {
    left: pct(o.x),
    bottom: pct(GRID_SIZE - (o.y + o.height)),
    width: pct(o.width),
    height: pct(vh / 40),
    zIndex: o.isFlat ? 1 : (o.y + o.height) * 10 + o.x,
  };
}

function Cells() {
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
  return <div className="cells">{cells}</div>;
}

function Wave({ style }: { style: CSSProperties }) {
  return (
    <svg className="wave" style={style} viewBox="0 0 40 14" aria-hidden="true">
      <path d="M2 9q5-6 10 0t10 0 10 0" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Boat() {
  return (
    <svg className="boat" style={{ left: "6%", top: "78%" }} viewBox="0 0 40 36" aria-hidden="true">
      <path d="M20 4v22" stroke={C.navy} strokeWidth="2" />
      <path d="M21 5l12 17H21Z" fill={C.yel} />
      <path d="M19 9l-9 13h9Z" fill="#fff" />
      <path d="M5 25h30l-5 8H10Z" fill={C.coral} />
      <path d="M8 29h24" stroke={C.coralD} strokeWidth="2" />
    </svg>
  );
}

/** 唯讀的積木島（建造模式在 Phase 2 加上） */
export function IslandBoard({ objects, label }: { objects: IslandObjectDto[]; label: string }) {
  return (
    <figure className="board" aria-label={label}>
      <Wave style={{ left: "76%", top: "6%" }} />
      <Wave style={{ left: "4%", top: "28%" }} />
      <Wave style={{ left: "86%", top: "57%" }} />
      <Boat />
      <div className="grid">
        <Cells />
        <div className="objs">
          {objects.map((o) => (
            <div key={o.id} className="obj" style={objectStyle(o)} title={o.name}>
              <BlockArt asset={o.assetKey} />
            </div>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">
        島上有：{objects.map((o) => `${o.name}（第 ${o.y + 1} 列第 ${o.x + 1} 格）`).join("、") || "還沒有任何東西"}
      </figcaption>
    </figure>
  );
}
