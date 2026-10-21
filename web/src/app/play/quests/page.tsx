import type { Metadata } from "next";
import Link from "next/link";
import { Bricks } from "@/components/game/bricks";
import { QuestCard } from "@/components/game/quest-card";
import { kidQuests } from "@/lib/auth/guards";
import { CATEGORY_LABEL, QUEST_CATEGORIES, type QuestCategory } from "@/lib/game/quests";

export const metadata: Metadata = { title: "理財任務" };

export default async function QuestsPage({ searchParams }: PageProps<"/play/quests">) {
  const quests = await kidQuests();
  const { cat } = await searchParams;
  const active = QUEST_CATEGORIES.includes(cat as QuestCategory) ? (cat as QuestCategory) : null;
  const list = active ? quests.filter((q) => q.category === active) : quests;
  const done = quests.filter((q) => q.status === "done").length;

  return (
    <section>
      <div className="view-head">
        <h1>理財任務</h1>
        <p>每個選擇都有好處和代價，沒有標準答案。完成挑戰就能得到獎勵。</p>
      </div>
      <div className="card qprogress">
        <b>
          已完成 {done} / {quests.length}
        </b>
        <Bricks percent={(done / Math.max(1, quests.length)) * 100} label="任務完成進度" color="sun" />
      </div>
      <nav className="chips" aria-label="任務分類">
        <Link className="chip" href="/play/quests" aria-current={active ? undefined : "page"}>
          全部
        </Link>
        {QUEST_CATEGORIES.map((c) => (
          <Link key={c} className="chip" href={`/play/quests?cat=${c}`} aria-current={active === c ? "page" : undefined}>
            {CATEGORY_LABEL[c]}
          </Link>
        ))}
      </nav>
      <div className="qgrid">
        {list.length ? list.map((q) => <QuestCard key={q.slug} quest={q} />) : <p className="card p-5 text-ink-2">這個分類還沒有任務。</p>}
      </div>
    </section>
  );
}
