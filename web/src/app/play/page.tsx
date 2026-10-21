import type { Metadata } from "next";
import { BlockArt } from "@/components/art/block-art";
import { IslandBuilder } from "@/components/island/island-builder";
import { requireKid } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "我的積木島" };

export default async function IslandPage() {
  const { state } = await requireKid();
  const { child, progress, island, inventory } = state;

  return (
    <section className="view-island">
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

      <IslandBuilder key={child.id} childName={child.displayName} initial={{ objects: island, inventory }} />

      <div className="home-cards">
        <div className="welcome span-all">
          <div className="welcome-art">
            <BlockArt asset="tent" />
            <BlockArt asset="tree" />
          </div>
          <div>
            <h2>歡迎來到你的積木島！</h2>
            <p>點「建造」把收藏放到島上，也可以移動或收回島上的作品。</p>
          </div>
        </div>
      </div>
    </section>
  );
}
