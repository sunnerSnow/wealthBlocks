import type { Metadata } from "next";
import { BlockArt } from "@/components/art/block-art";
import { IslandBoard } from "@/components/island-board";
import { requireKid } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "我的積木島" };

export default async function IslandPage() {
  const { state } = await requireKid();
  const { child, progress, island, inventory } = state;
  const freeTotal = inventory.reduce((n, i) => n + i.quantity, 0);

  return (
    <section>
      <div className="xpstrip">
        <span className="lv-badge">Lv.{progress.level}</span>
        <span>{progress.title}</span>
        <span className="xpbar" aria-hidden="true">
          <i style={{ width: `${progress.percent}%` }} />
        </span>
        <span className="num text-ink-2">
          {progress.current}/{progress.needed}
        </span>
      </div>

      <div className="board-wrap">
        <div className="board-head">
          <h1>{child.displayName}的積木島</h1>
          <span>{island.length} 件作品</span>
        </div>
        <IslandBoard objects={island} label={`${child.displayName}的積木島`} />
      </div>

      <div className="home-cards">
        <div className="welcome span-all">
          <div className="welcome-art">
            <BlockArt asset="tent" />
            <BlockArt asset="tree" />
          </div>
          <div>
            <h2>歡迎來到你的積木島！</h2>
            <p>完成理財挑戰、存積木幣，一步一步打造自己的世界。</p>
          </div>
        </div>

        <section className="span-all">
          <h2 className="sec-title">我的收藏</h2>
          {inventory.length ? (
            <div className="card p-4">
              <p className="mb-3 text-[15px] text-ink-2">新手禮包裡有 {freeTotal} 件東西，還沒放到島上。</p>
              <ul className="inv-grid">
                {inventory.map((i) => (
                  <li key={i.slug} className="inv">
                    <BlockArt asset={i.assetKey} />
                    {i.name}
                    <small>× {i.quantity}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="card p-4 text-[15px] text-ink-2">收藏是空的，島上的作品都已經放好了。</p>
          )}
        </section>
      </div>
    </section>
  );
}
