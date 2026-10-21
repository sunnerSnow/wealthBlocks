"use client";

import { type KeyboardEvent, type MouseEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { BlockArt } from "@/components/art/block-art";
import { Icon } from "@/components/icons";
import { footprintStyle, objectStyle } from "@/components/island/geometry";
import { Cells, Water } from "@/components/island/scenery";
import { GRID_SIZE, checkPlacement, isLand } from "@/lib/game/island";
import type { BuildingDto, InventoryItemDto, IslandObjectDto, IslandStateDto } from "@/lib/services/island";

type Sel = { kind: "new"; slug: string } | { kind: "pick"; id: string } | { kind: "move"; id: string };
interface Build {
  sel: Sel | null;
  ghost: { x: number; y: number } | null;
}
type Spot = { x: number; y: number };

const CATEGORY_LABEL: Record<BuildingDto["category"], string> = { building: "建築", deco: "裝飾", terrain: "地形", nature: "自然" };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const sameSpot = (a: Spot | null, b: Spot | null) => !!a && !!b && a.x === b.x && a.y === b.y;

/** 選好要放的東西時，先替孩子找一個離中心近、周圍空曠的合法位置 */
function findSpot(def: BuildingDto, objects: IslandObjectDto[], ignoreId?: string): Spot | null {
  const busy = (x: number, y: number) =>
    objects.some((o) => o.id !== ignoreId && !o.isFlat && x >= o.x && x < o.x + o.width && y >= o.y && y < o.y + o.height);
  let best: (Spot & { score: number }) | null = null;
  for (let y = 0; y <= GRID_SIZE - def.height; y++) {
    for (let x = 0; x <= GRID_SIZE - def.width; x++) {
      if (!checkPlacement({ x, y, width: def.width, height: def.height }, objects, ignoreId).ok) continue;
      let crowd = 0;
      for (let dy = -1; dy <= def.height; dy++) for (let dx = -1; dx <= def.width; dx++) if (busy(x + dx, y + dy)) crowd++;
      const score = Math.hypot(x + def.width / 2 - 4.5, y + def.height / 2 - 4.5) + crowd * 1.5;
      if (!best || score < best.score) best = { x, y, score };
    }
  }
  return best && { x: best.x, y: best.y };
}

interface ApiResult {
  data: IslandStateDto | null;
  errors: { message: string }[];
}

export function IslandBuilder({ childName, initial }: { childName: string; initial: IslandStateDto }) {
  const [island, setIsland] = useState(initial);
  const [build, setBuild] = useState<Build | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const [info, setInfo] = useState<IslandObjectDto | null>(null);
  const [justPlaced, setJustPlaced] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);

  const sel = build?.sel ?? null;
  const placing = sel?.kind === "new" || sel?.kind === "move";
  const selDef: BuildingDto | null = !sel
    ? null
    : sel.kind === "new"
      ? (island.inventory.find((i) => i.slug === sel.slug) ?? null)
      : (island.objects.find((o) => o.id === sel.id) ?? null);
  const ignoreId = sel?.kind === "move" ? sel.id : undefined;
  const ghost = placing ? (build?.ghost ?? null) : null;
  const check = ghost && selDef ? checkPlacement({ ...ghost, width: selDef.width, height: selDef.height }, island.objects, ignoreId) : null;
  const inventoryTotal = island.inventory.reduce((n, i) => n + i.quantity, 0);

  let freeCells = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (isLand(x, y) && !island.objects.some((o) => x >= o.x && x < o.x + o.width && y >= o.y && y < o.y + o.height)) freeCells++;
    }
  }

  function status(): { tone: "" | "ok" | "bad"; text: string } {
    if (!sel || !selDef) return { tone: "", text: "選一件收藏放到島上，或點島上的作品來移動。" };
    if (sel.kind === "pick") {
      return selDef.isMovable
        ? { tone: "", text: `選好了「${selDef.name}」，要移動還是收回？` }
        : { tone: "", text: `「${selDef.name}」是${selDef.source || "島上原有"}的，不能移動。` };
    }
    if (!check) return { tone: "", text: `點島上的位置來放「${selDef.name}」（佔 ${selDef.width}×${selDef.height} 格）` };
    if (check.ok) return { tone: "ok", text: "這裡可以放！再點一次，或按下方按鈕確認。" };
    if (check.reason === "outside") return { tone: "bad", text: "超出島嶼範圍了，要放在綠色的土地上" };
    const other = island.objects.find((o) => o.id === check.withId);
    return { tone: "bad", text: `和「${other?.name ?? "其他建築"}」重疊了，換個位置吧` };
  }
  const st = status();

  // 建造模式時，手機底部導覽換成建造工具列
  useEffect(() => {
    document.body.classList.toggle("is-building", build !== null);
    return () => document.body.classList.remove("is-building");
  }, [build]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!justPlaced) return;
    const timer = setTimeout(() => setJustPlaced(null), 600);
    return () => clearTimeout(timer);
  }, [justPlaced]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (info && !dialog.open) dialog.showModal();
    if (!info && dialog.open) dialog.close();
  }, [info]);

  // Esc：先取消選取，再離開建造模式（物件說明視窗由瀏覽器自己處理）
  useEffect(() => {
    if (!build) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || dialogRef.current?.open) return;
      setBuild((b) => (b?.sel ? { sel: null, ghost: null } : null));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [build]);

  const say = (msg: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, msg }));

  async function call(method: "POST" | "PATCH" | "DELETE", url: string, body?: object): Promise<IslandStateDto | null> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json().catch(() => null)) as ApiResult | null;
      if (!res.ok || !json?.data) {
        say(json?.errors?.[0]?.message ?? "系統發生錯誤，請稍後再試");
        return null;
      }
      setIsland(json.data);
      return json.data;
    } catch {
      say("連線不穩，請再試一次");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function confirmPlace() {
    if (!sel || !ghost || !selDef || busy || sel.kind === "pick") return;
    if (!check?.ok) {
      say(st.text);
      return;
    }
    if (sel.kind === "new") {
      const next = await call("POST", "/api/island/objects", { slug: sel.slug, ...ghost });
      if (!next) return;
      setJustPlaced(next.objects.find((o) => o.slug === sel.slug && o.x === ghost.x && o.y === ghost.y)?.id ?? null);
      const left = next.inventory.find((i) => i.slug === sel.slug)?.quantity ?? 0;
      setBuild({ sel: left > 0 ? sel : null, ghost: null });
      say(`放好了「${selDef.name}」${left > 0 ? "，還可以再放一個" : ""}`);
    } else {
      const next = await call("PATCH", `/api/island/objects/${sel.id}`, ghost);
      if (!next) return;
      setJustPlaced(sel.id);
      setBuild({ sel: null, ghost: null });
      say(`「${selDef.name}」移好了`);
    }
  }

  async function storePicked() {
    if (sel?.kind !== "pick" || !selDef || busy) return;
    const next = await call("DELETE", `/api/island/objects/${sel.id}`);
    if (!next) return;
    setBuild({ sel: null, ghost: null });
    say(`「${selDef.name}」收回到收藏了`);
  }

  function startMove() {
    if (sel?.kind !== "pick") return;
    const obj = island.objects.find((o) => o.id === sel.id);
    if (!obj) return;
    setBuild({ sel: { kind: "move", id: obj.id }, ghost: { x: obj.x, y: obj.y } });
    // 立刻把焦點交給格線（tabIndex -1 也能用程式聚焦），接著按的方向鍵才不會漏掉
    gridRef.current?.focus({ preventScroll: true });
  }

  function pickItem(item: InventoryItemDto) {
    if (sel?.kind === "new" && sel.slug === item.slug) {
      setBuild({ sel: null, ghost: null });
      return;
    }
    setBuild({ sel: { kind: "new", slug: item.slug }, ghost: findSpot(item, island.objects) });
  }

  function anchorAt(clientX: number, clientY: number): Spot | null {
    const grid = gridRef.current;
    if (!grid || !selDef) return null;
    const r = grid.getBoundingClientRect();
    const fx = ((clientX - r.left) / r.width) * GRID_SIZE;
    const fy = ((clientY - r.top) / r.height) * GRID_SIZE;
    if (fx < -0.5 || fy < -0.5 || fx > GRID_SIZE + 0.5 || fy > GRID_SIZE + 0.5) return null;
    // 讓佔地範圍以指標為中心（2×2 的建築會落在最近的格線交點上）
    return {
      x: clamp(Math.round(fx - selDef.width / 2), 0, GRID_SIZE - selDef.width),
      y: clamp(Math.round(fy - selDef.height / 2), 0, GRID_SIZE - selDef.height),
    };
  }

  function onGridClick(e: MouseEvent) {
    if (!build) return;
    if (!placing) {
      if (sel) setBuild({ sel: null, ghost: null });
      return;
    }
    if (drag.current?.moved) {
      drag.current = null;
      return;
    }
    const spot = anchorAt(e.clientX, e.clientY);
    if (!spot) return;
    if (sameSpot(spot, ghost)) void confirmPlace();
    else setBuild({ ...build, ghost: spot });
  }

  function onPointerDown(e: PointerEvent) {
    if (!placing) return;
    drag.current = e.pointerType === "mouse" ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  }

  function onPointerMove(e: PointerEvent) {
    if (!placing) return;
    const d = drag.current;
    const hovering = e.pointerType === "mouse" && e.buttons === 0;
    const dragging = !!d && d.id === e.pointerId && (d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6);
    if (!hovering && !dragging) return;
    if (dragging && d) d.moved = true;
    const spot = anchorAt(e.clientX, e.clientY);
    if (spot && !sameSpot(spot, ghost)) setBuild((b) => (b ? { ...b, ghost: spot } : b));
  }

  function onGridKey(e: KeyboardEvent) {
    if (!placing || !selDef) return;
    const delta = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[e.key];
    if (delta) {
      e.preventDefault();
      const from = ghost ?? findSpot(selDef, island.objects, ignoreId) ?? { x: 0, y: 0 };
      setBuild((b) =>
        b ? { ...b, ghost: { x: clamp(from.x + delta[0], 0, GRID_SIZE - selDef.width), y: clamp(from.y + delta[1], 0, GRID_SIZE - selDef.height) } } : b,
      );
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void confirmPlace();
    }
  }

  function onObject(e: MouseEvent, o: IslandObjectDto) {
    e.stopPropagation();
    if (!build) {
      setInfo(o);
      return;
    }
    if (placing) return;
    setBuild({ sel: sel?.kind === "pick" && sel.id === o.id ? null : { kind: "pick", id: o.id }, ghost: null });
  }

  const picked = sel && sel.kind !== "new" ? sel.id : null;

  return (
    <>
      <div className="board-wrap">
        <div className="board-head">
          <h1>{childName}的積木島</h1>
          <span>
            {island.objects.length} 件作品 · 空地 {freeCells} 格
          </span>
        </div>
        <figure className={`board ${build ? "building" : ""}`} aria-label={`${childName}的積木島`}>
          <Water />
          <div
            ref={gridRef}
            className={`grid ${placing ? "placing" : ""}`}
            onClick={onGridClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onKeyDown={onGridKey}
            tabIndex={placing ? 0 : -1}
            role={placing ? "application" : undefined}
            aria-label={placing ? "島嶼格線：用方向鍵移動位置，按 Enter 放下，Esc 取消" : undefined}
          >
            <Cells />
            <div className="gridlines" aria-hidden="true" />
            <div className="objs">
              {island.objects.map((o) => {
                const moving = sel?.kind === "move" && sel.id === o.id;
                const cls = ["obj", picked === o.id && !moving ? "sel" : "", moving ? "moving" : "", justPlaced === o.id ? "pop" : ""].join(" ");
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={cls}
                    style={objectStyle(o)}
                    onClick={(e) => onObject(e, o)}
                    aria-label={`${o.name}，第 ${o.y + 1} 列第 ${o.x + 1} 格`}
                    aria-pressed={build ? picked === o.id : undefined}
                  >
                    <BlockArt asset={o.assetKey} />
                  </button>
                );
              })}
            </div>
            {ghost && selDef ? (
              <>
                <div className={`fp ${check?.ok ? "ok" : "bad"}`} style={footprintStyle({ ...ghost, width: selDef.width, height: selDef.height })} />
                <div className={`ghost ${check?.ok ? "" : "bad"}`} style={{ ...objectStyle({ ...selDef, ...ghost }), zIndex: 901 }}>
                  <BlockArt asset={selDef.assetKey} />
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className={`btn fab ${build ? "btn-success" : "btn-primary"}`}
            onClick={() => setBuild(build ? null : { sel: null, ghost: null })}
          >
            <Icon name={build ? "check" : "hammer"} />
            {build ? "完成" : "建造"}
          </button>
        </figure>
        {build ? (
          <p className="sr-only" aria-live="polite">
            {st.text}
          </p>
        ) : null}
      </div>

      {build ? (
        <div className="tray">
          <div className="tray-head">
            <b>建造模式</b>
            <p className={`tray-status ${st.tone}`}>{st.text}</p>
          </div>
          {!sel || sel.kind === "new" ? (
            island.inventory.length ? (
              <div className="tray-items" aria-label="可以放的收藏">
                {island.inventory.map((i) => (
                  <button
                    key={i.slug}
                    type="button"
                    className="ichip"
                    aria-pressed={sel?.kind === "new" && sel.slug === i.slug}
                    onClick={() => pickItem(i)}
                  >
                    <BlockArt asset={i.assetKey} />
                    <span>{i.name}</span>
                    <span className="cnt">×{i.quantity}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="tray-empty">收藏裡沒有可以放的東西了。之後完成任務、存積木幣，就能得到更多建築。</p>
            )
          ) : null}
          {placing ? (
            <div className="tray-actions">
              <button type="button" className="btn" onClick={() => setBuild({ sel: null, ghost: null })} disabled={busy}>
                取消
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void confirmPlace()} disabled={busy || !check?.ok} aria-busy={busy}>
                <Icon name="check" />
                {sel?.kind === "move" ? "移到這裡" : "放在這裡"}
              </button>
            </div>
          ) : sel?.kind === "pick" ? (
            <div className="tray-actions">
              {selDef?.isMovable ? (
                <>
                  <button type="button" className="btn" onClick={() => void storePicked()} disabled={busy} aria-busy={busy}>
                    <Icon name="undo" />
                    收回到收藏
                  </button>
                  <button type="button" className="btn btn-primary" onClick={startMove} disabled={busy}>
                    <Icon name="move" />
                    移動
                  </button>
                </>
              ) : (
                <button type="button" className="btn" onClick={() => setBuild({ sel: null, ghost: null })}>
                  知道了
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : inventoryTotal > 0 ? (
        <div className="card nudge">
          <p>有 {inventoryTotal} 件收藏可以放到島上</p>
          <button type="button" className="btn btn-sm" onClick={() => setBuild({ sel: null, ghost: null })}>
            <Icon name="hammer" />
            去建造
          </button>
        </div>
      ) : null}

      <dialog ref={dialogRef} className="sheet-dialog" onClose={() => setInfo(null)} aria-labelledby="obj-title">
        {info ? (
          <>
            <div className="sheet-head">
              <h2 id="obj-title">{info.name}</h2>
              <button type="button" className="icon-btn" onClick={() => setInfo(null)} aria-label="關閉">
                <Icon name="x" />
              </button>
            </div>
            <div className="sheet-body">
              <div className="art-stage">
                <BlockArt asset={info.assetKey} />
              </div>
              <div className="kv">
                <span className="badge">{CATEGORY_LABEL[info.category]}</span>
                <span className="badge">
                  佔 {info.width}×{info.height} 格
                </span>
                {info.source ? <span className="badge">取得方式：{info.source}</span> : null}
              </div>
              <p>{info.description}</p>
            </div>
            <div className="sheet-foot">
              <button type="button" className="btn" onClick={() => setInfo(null)}>
                關閉
              </button>
              {info.isMovable ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setInfo(null);
                    setBuild({ sel: { kind: "pick", id: info.id }, ghost: null });
                  }}
                >
                  <Icon name="move" />
                  移動或收回
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </dialog>

      <div className="toast-root" role="status" aria-live="polite">
        {toast ? (
          <div key={toast.id} className="toast">
            {toast.msg}
          </div>
        ) : null}
      </div>
    </>
  );
}
