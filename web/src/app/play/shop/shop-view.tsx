"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BlockArt } from "@/components/art/block-art";
import { Coin } from "@/components/brand";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/feedback";
import { ApiError, api, newRequestId } from "@/lib/client/api";
import type { GoalDto } from "@/lib/services/goals";
import type { PurchaseDto, ShopDto, ShopItemDto } from "@/lib/services/shop";

const CATS = [
  ["all", "全部"],
  ["deco", "裝飾"],
  ["building", "建築"],
  ["terrain", "地形"],
  ["wear", "造型"],
] as const;
type Cat = (typeof CATS)[number][0];
const CAT_LABEL: Record<ShopItemDto["category"], string> = { deco: "裝飾", building: "建築", terrain: "地形", wear: "造型" };

function Badge({ item }: { item: ShopItemDto }) {
  if (item.status === "locked")
    return (
      <span className="badge badge-lock">
        <Icon name="lock" className="ic" />
        Lv.{item.minLevel} 解鎖
      </span>
    );
  if (item.status === "owned") return <span className="badge badge-ok">{item.equipped ? "戴著" : "已擁有"}</span>;
  if (item.goal) return <span className="badge badge-goal">存錢中</span>;
  if (item.isUnique) return <span className="badge">限購一次</span>;
  return item.owned ? <span className="badge">已有 {item.owned}</span> : null;
}

export function ShopView({ initial }: { initial: ShopDto }) {
  const router = useRouter();
  const [shop, setShop] = useState(initial);
  const [cat, setCat] = useState<Cat>("all");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  const { say, node: toastNode } = useToast();

  const item = shop.items.find((i) => i.slug === openSlug) ?? null;
  const list = shop.items.filter((i) => cat === "all" || i.category === cat);

  function open(slug: string) {
    // 每次打開確認視窗是新的一次購買；連點「確認購買」會帶同一個編號，伺服器只扣一次
    requestId.current = newRequestId();
    setOpenSlug(slug);
  }

  async function reload() {
    setShop(await api<ShopDto>("GET", "/api/shop/items"));
    router.refresh();
  }

  async function buy() {
    if (!item || busy || !requestId.current) return;
    setBusy(true);
    try {
      const res = await api<PurchaseDto>("POST", "/api/shop/purchase", { slug: item.slug, requestId: requestId.current });
      setOpenSlug(null);
      say(
        `買好了「${item.name}」，已放進收藏${res.refunded ? `；原本存的 ${res.refunded} 積木幣退回錢包` : ""}${item.category === "wear" ? "（到「我的」可以戴上）" : "（到島嶼按「建造」放上去）"}`,
      );
      await reload();
    } catch (error) {
      say(error instanceof ApiError ? error.message : "系統發生錯誤，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  async function makeGoal() {
    if (!item || busy) return;
    setBusy(true);
    try {
      await api<GoalDto>("POST", "/api/goals", { reward: item.slug });
      router.push("/play/goals");
      router.refresh();
    } catch (error) {
      say(error instanceof ApiError ? error.message : "系統發生錯誤，請稍後再試");
      setBusy(false);
    }
  }

  async function wear(slug: string | null) {
    setBusy(true);
    try {
      await api("POST", "/api/shop/equip", { slug });
      setOpenSlug(null);
      say(slug ? "戴上了！" : "摘下來了");
      await reload();
    } catch (error) {
      say(error instanceof ApiError ? error.message : "系統發生錯誤，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  let info = null;
  let foot = null;
  if (item) {
    if (item.status === "buy") {
      info = (
        <div className="think">
          <Icon name="bulb" />
          <span>想一想：這是你「需要」的，還是「想要」的？兩種都可以，想清楚再決定就好。</span>
        </div>
      );
      foot = (
        <>
          <button type="button" className="btn" onClick={() => setOpenSlug(null)} disabled={busy}>
            再想想
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void buy()} disabled={busy} aria-busy={busy}>
            {busy ? "購買中…" : `確認購買 · ${item.price}`}
          </button>
        </>
      );
    } else if (item.status === "poor") {
      info = (
        <div className="warn">
          <Icon name="info" />
          <span>還差 {item.price - shop.balance} 積木幣。可以先完成任務，或把它設成儲蓄目標，一點一點存。</span>
        </div>
      );
      foot = (
        <>
          <Link className="btn" href="/play/quests">
            去做任務
          </Link>
          {item.goal ? (
            <Link className="btn btn-primary" href="/play/goals">
              查看儲蓄目標
            </Link>
          ) : item.category === "building" || item.category === "terrain" ? (
            <button type="button" className="btn btn-primary" onClick={() => void makeGoal()} disabled={busy}>
              <Icon name="piggy" />
              設成儲蓄目標
            </button>
          ) : null}
        </>
      );
    } else if (item.status === "locked") {
      info = (
        <div className="think">
          <Icon name="lock" />
          <span>升到 Lv.{item.minLevel} 就能購買。完成理財任務可以得到經驗值。</span>
        </div>
      );
      foot = (
        <Link className="btn btn-primary" href="/play/quests">
          去做任務
        </Link>
      );
    } else {
      info = (
        <div className="okbox">
          <Icon name="check" />
          <span>你已經擁有這個了。</span>
        </div>
      );
      foot =
        item.category === "wear" ? (
          <button type="button" className="btn btn-primary" onClick={() => void wear(item.equipped ? null : item.slug)} disabled={busy}>
            {item.equipped ? "摘下" : "戴上"}
          </button>
        ) : (
          <Link className="btn btn-success" href="/play">
            <Icon name="hammer" />
            到島嶼建造
          </Link>
        );
    }
  }

  return (
    <>
      <div className="chips" role="group" aria-label="商品分類">
        {CATS.map(([k, label]) => (
          <button key={k} type="button" className="chip" aria-pressed={cat === k} onClick={() => setCat(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="sgrid">
        {list.map((i) => (
          <button key={i.slug} type="button" className={`scard ${i.status === "locked" ? "dim" : ""}`} onClick={() => open(i.slug)}>
            <span className="scard-art">
              <BlockArt asset={i.assetKey} />
            </span>
            <span className="scard-body">
              <b>{i.name}</b>
              <span className="scard-cat">
                {CAT_LABEL[i.category]}
                {i.size ? ` · 佔 ${i.size.width}×${i.size.height} 格` : ""}
              </span>
              <span className="scard-foot">
                <span className="price">
                  <Coin />
                  {i.price}
                </span>
                <Badge item={i} />
              </span>
            </span>
          </button>
        ))}
      </div>

      <Sheet open={item !== null} onClose={() => setOpenSlug(null)} title={item?.name ?? ""} footer={foot}>
        {item ? (
          <>
            <div className="art-stage">
              <BlockArt asset={item.assetKey} />
            </div>
            <div className="kv">
              <span className="badge">{CAT_LABEL[item.category]}</span>
              {item.size ? (
                <span className="badge">
                  佔 {item.size.width}×{item.size.height} 格
                </span>
              ) : null}
              <span className="badge">{item.isUnique ? "限購一次" : "可以重複購買"}</span>
            </div>
            <p>{item.description}</p>
            {item.status === "buy" || item.status === "poor" ? (
              <div className="pricebox">
                <div className="row">
                  <span>價格</span>
                  <span className="num">
                    <Coin />
                    {item.price}
                  </span>
                </div>
                <div className="row">
                  <span>你的積木幣</span>
                  <span className="num">
                    {shop.balance}
                    {item.status === "buy" ? (
                      <>
                        <span className="arrow">→</span>
                        {shop.balance - item.price}
                      </>
                    ) : null}
                  </span>
                </div>
              </div>
            ) : null}
            {item.goal ? (
              <p className="mt-3 text-[14px] text-ink-2">
                你正在為它存錢：{item.goal.saved} / {item.goal.target}。直接買的話，存的錢會退回錢包。
              </p>
            ) : null}
            {info}
          </>
        ) : null}
      </Sheet>
      {toastNode}
    </>
  );
}
