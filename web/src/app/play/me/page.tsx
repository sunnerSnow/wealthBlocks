import type { Metadata } from "next";
import Link from "next/link";
import { switchPlayerAction } from "@/app/actions";
import { BlockArt } from "@/components/art/block-art";
import { Avatar } from "@/components/avatar";
import { CATEGORY_ICON, CategoryChip } from "@/components/game/quest-card";
import { Icon } from "@/components/icons";
import { kidGoals, kidQuests, requireKid } from "@/lib/auth/guards";
import { AGE_BAND_LABEL } from "@/lib/game/input";
import { CATEGORY_LABEL, QUEST_CATEGORIES } from "@/lib/game/quests";
import { listLearningLog } from "@/lib/services/quests";
import { listShop } from "@/lib/services/shop";
import { WearButton } from "./wear-button";

export const metadata: Metadata = { title: "我的" };

function when(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });
}

export default async function MePage() {
  const { db, user, state } = await requireKid();
  const [quests, goals, shop, log] = await Promise.all([
    kidQuests(),
    kidGoals(),
    listShop(db, user.id, state.child.id),
    listLearningLog(db, user.id, state.child.id),
  ]);
  const { child, progress, island, balance, inventory } = state;
  const done = quests.filter((q) => q.status === "done");
  const saving = goals.goals.filter((g) => g.status === "active").reduce((n, g) => n + g.saved, 0);
  const wears = shop.items.filter((i) => i.category === "wear" && i.status === "owned");

  return (
    <section className="mx-auto grid max-w-[760px] gap-4">
      <div className="view-head">
        <h1>我的</h1>
      </div>
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <Avatar avatarKey={child.avatarKey} hat={state.equippedWear} className="av av-lg" />
          <div className="flex-1">
            <h2 className="text-[22px] font-extrabold">{child.displayName}</h2>
            <p className="text-[14px] text-ink-2">
              {AGE_BAND_LABEL[child.ageBand]} · Lv.{progress.level} {progress.title} · 經驗 {progress.current}/{progress.needed}
            </p>
            <span className="xpbar mt-2 max-w-[260px]" aria-hidden="true">
              <i style={{ width: `${progress.percent}%` }} />
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="stat">
            <small>積木幣</small>
            <b>{balance}</b>
          </div>
          <div className="stat">
            <small>儲蓄中</small>
            <b>{saving}</b>
          </div>
          <div className="stat">
            <small>完成任務</small>
            <b>{done.length}</b>
            <span>/ {quests.length}</span>
          </div>
          <div className="stat">
            <small>島上作品</small>
            <b>{island.length}</b>
            <span>件</span>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="sec-title">接觸過的理財主題</h2>
        <div className="topic-chips">
          {QUEST_CATEGORIES.map((c) =>
            done.some((q) => q.category === c) ? (
              <CategoryChip key={c} category={c} icon={CATEGORY_ICON[c]} />
            ) : (
              <span key={c} className="cat off">
                <Icon name="lock" />
                {CATEGORY_LABEL[c]}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="sec-title">我的收藏</h2>
        {inventory.length || wears.length ? (
          <ul className="inv-grid">
            {inventory.map((i) => (
              <li key={i.slug} className="inv">
                <BlockArt asset={i.assetKey} />
                {i.name}
                <small>還沒放 × {i.quantity}</small>
                <Link className="btn" href="/play">
                  去建造
                </Link>
              </li>
            ))}
            {wears.map((w) => (
              <li key={w.slug} className="inv">
                <BlockArt asset={w.assetKey} />
                {w.name}
                <small>{w.equipped ? "戴著" : "造型"}</small>
                <WearButton slug={w.slug} equipped={w.equipped} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ink-2">收藏是空的，島上的作品都已經放好了。</p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="sec-title">學習紀錄</h2>
        {log.length ? (
          <ul className="log-list">
            {log.map((l, i) => (
              <li key={i}>
                <CategoryChip category={l.category} />
                <div>
                  <b>{l.title}</b>
                  <small>
                    你選了：{l.label} · {when(l.completedAt)}
                    {l.rewarded ? "" : " · 再玩一次"}
                  </small>
                  <small>思考題：{l.reflect}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ink-2">完成任務後，這裡會記下你的選擇和想法。</p>
        )}
      </div>

      <form action={switchPlayerAction} className="card flex flex-wrap items-center gap-3 p-5">
        <p className="flex-1 text-[15px]">玩好了嗎？換下一位，或請家長回到家長區。</p>
        <button className="btn" type="submit">
          <Icon name="swap" />
          換人玩
        </button>
      </form>
    </section>
  );
}
