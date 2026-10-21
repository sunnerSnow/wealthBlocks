import type { Metadata } from "next";
import Link from "next/link";
import { BlockArt } from "@/components/art/block-art";
import { GoalMini, topGoal } from "@/components/game/goal-mini";
import { QuestCard } from "@/components/game/quest-card";
import { IslandBuilder } from "@/components/island/island-builder";
import { kidGoals, kidQuests, requireKid } from "@/lib/auth/guards";
import { nextOpenQuest } from "@/lib/services/quests";

export const metadata: Metadata = { title: "我的積木島" };

export default async function IslandPage() {
  const { state } = await requireKid();
  const [quests, goals] = await Promise.all([kidQuests(), kidGoals()]);
  const { child, progress, island, inventory } = state;
  const quest = nextOpenQuest(quests);
  const goal = topGoal(goals.goals);
  const fresh = !quests.some((q) => q.status === "done");

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

      {/* 桌面版這些在右側欄，這裡只在手機與平板顯示 */}
      <div className="home-cards hide-wide">
        {fresh ? (
          <div className="welcome span-all">
            <div className="welcome-art">
              <BlockArt asset="tent" />
              <BlockArt asset="tree" />
            </div>
            <div>
              <h2>歡迎來到你的積木島！</h2>
              <p>完成第一個理財挑戰，開始打造自己的世界吧。</p>
            </div>
          </div>
        ) : null}
        <section>
          <h2 className="sec-title">
            今日推薦任務
            <Link className="link" href="/play/quests">
              全部任務
            </Link>
          </h2>
          {quest ? <QuestCard quest={quest} /> : <p className="card p-4 text-[15px] text-ink-2">目前的任務都完成了，升級後會解鎖新的挑戰！</p>}
        </section>
        <section>
          <h2 className="sec-title">
            儲蓄目標
            <Link className="link" href="/play/goals">
              全部目標
            </Link>
          </h2>
          {goal ? <GoalMini goal={goal} /> : <p className="card p-4 text-[15px] text-ink-2">還沒有進行中的目標。到「目標」挑一個想要的建築開始存吧！</p>}
        </section>
      </div>
    </section>
  );
}
