import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Brand, Coin } from "@/components/brand";
import { GoalMini, topGoal } from "@/components/game/goal-mini";
import { CATEGORY_ICON } from "@/components/game/quest-card";
import { Icon } from "@/components/icons";
import { LocalBanner } from "@/components/local-banner";
import { TxList } from "@/components/tx-list";
import { kidGoals, kidQuests, requireKid } from "@/lib/auth/guards";
import { KidsNav } from "./kids-nav";

/** 孩子模式外框：頂端（積木幣、等級、頭像）＋導覽＋桌面右側欄；每個頁面仍會自己呼叫 requireKid */
export default async function PlayLayout({ children }: LayoutProps<"/play">) {
  const { state } = await requireKid();
  const [quests, goals] = await Promise.all([kidQuests(), kidGoals()]);
  const { progress } = state;
  const open = quests.filter((q) => q.status === "open").length;
  const goal = topGoal(goals.goals);
  return (
    <>
      <LocalBanner />
      <div className="kid-app">
        <header className="topbar">
          <Link href="/play" aria-label="回到積木島" className="rounded-lg">
            <Brand />
          </Link>
          <span className="mode-badge kids">Kids 財富遊樂場</span>
          <span className="top-spacer" />
          <div className="top-level" aria-label={`等級 ${progress.level}，經驗 ${progress.current}/${progress.needed}`}>
            <span className="lv-badge">Lv.{progress.level}</span>
            <span>{progress.title}</span>
            <span className="xpbar" aria-hidden="true">
              <i style={{ width: `${progress.percent}%` }} />
            </span>
            <span className="num text-ink-2">
              {progress.current}/{progress.needed}
            </span>
          </div>
          <Link className="coinpill" href="/play/ledger" aria-label={`積木幣 ${state.balance}，查看帳本`}>
            <Coin />
            <span>{state.balance}</span>
          </Link>
          <Link className="avatar-link" href="/play/me" aria-label={`${state.child.displayName}的個人頁`}>
            <Avatar avatarKey={state.child.avatarKey} hat={state.equippedWear} />
            <span className="name">{state.child.displayName}</span>
          </Link>
        </header>

        <nav className="sidenav" aria-label="主要功能">
          <KidsNav variant="side" openQuests={open} />
        </nav>

        <main className="kid-main">{children}</main>

        <aside className="rail" aria-label="今日摘要">
          <section className="rail-sec">
            <h2 className="sec-title">
              今日任務
              <Link className="link" href="/play/quests">
                全部
              </Link>
            </h2>
            <div className="rq-list">
              {quests.map((q) => {
                const sub = q.status === "done" ? "已完成 · 獎勵已領取" : q.status === "locked" ? `Lv.${q.minLevel} 解鎖` : `+${q.rewardXp} 經驗 · +${q.rewardCoins} 積木幣`;
                const icon = q.status === "locked" ? "lock" : q.status === "done" ? "check" : CATEGORY_ICON[q.category];
                const body = (
                  <>
                    <span className={`cat cat-${q.category}`}>
                      <Icon name={icon} />
                    </span>
                    <span className="t">
                      <b>{q.title}</b>
                      <small>{sub}</small>
                    </span>
                  </>
                );
                return q.status === "locked" ? (
                  <div key={q.slug} className="rq locked">
                    {body}
                  </div>
                ) : (
                  <Link key={q.slug} className="rq" href={`/play/quests/${q.slug}`}>
                    {body}
                    <Icon name="chev" />
                  </Link>
                );
              })}
            </div>
          </section>
          <section className="rail-sec">
            <h2 className="sec-title">
              儲蓄目標
              <Link className="link" href="/play/goals">
                全部
              </Link>
            </h2>
            {goal ? <GoalMini goal={goal} /> : <p className="card p-4 text-[15px] text-ink-2">還沒有進行中的目標。到「目標」挑一個想要的建築開始存吧！</p>}
          </section>
          <section className="rail-sec">
            <h2 className="sec-title">
              近期活動
              <Link className="link" href="/play/ledger">
                帳本
              </Link>
            </h2>
            <div className="card px-4 py-1">
              <TxList items={state.recentTransactions} />
            </div>
          </section>
        </aside>

        <nav className="tabbar" aria-label="主要功能">
          <KidsNav variant="tab" openQuests={open} />
        </nav>
      </div>
    </>
  );
}
