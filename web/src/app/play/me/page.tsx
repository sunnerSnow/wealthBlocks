import type { Metadata } from "next";
import { switchPlayerAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { requireKid } from "@/lib/auth/guards";
import { AGE_BAND_LABEL } from "@/lib/game/input";

export const metadata: Metadata = { title: "我的" };

export default async function MePage() {
  const { state } = await requireKid();
  const { child, progress, island, balance } = state;

  return (
    <section className="mx-auto grid max-w-[640px] gap-4">
      <div className="view-head">
        <h1>我的</h1>
      </div>
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <Avatar avatarKey={child.avatarKey} className="av av-lg" />
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
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="stat">
            <small>積木幣</small>
            <b>{balance}</b>
          </div>
          <div className="stat">
            <small>島上作品</small>
            <b>{island.length}</b>
            <span>件</span>
          </div>
        </div>
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
