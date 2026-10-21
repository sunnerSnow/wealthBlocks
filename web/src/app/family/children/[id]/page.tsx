import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startPlayingAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Coin } from "@/components/brand";
import { Bricks } from "@/components/game/bricks";
import { CATEGORY_ICON, CategoryChip } from "@/components/game/quest-card";
import { Icon } from "@/components/icons";
import { ParentTop } from "@/components/parent-top";
import { TxList } from "@/components/tx-list";
import { requireParentArea } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import { WEEKDAY_LABEL } from "@/lib/game/allowance";
import { AGE_BAND_LABEL } from "@/lib/game/input";
import type { SettingKey } from "@/lib/db/schema";
import { getChildProgress } from "@/lib/services/progress";
import { ParentGoalForm } from "./goal-form";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "孩子的學習進度" };

const SETTING_LABEL: Record<SettingKey, string> = {
  allowance_enabled: "零用錢",
  allowance_amount: "每次金額",
  allowance_interval: "發放週期",
  allowance_weekday: "發放日",
  allow_child_goals: "孩子自己設定目標",
};

function settingValue(key: SettingKey, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (key === "allowance_enabled" || key === "allow_child_goals") return value ? "開" : "關";
  if (key === "allowance_interval") return value === 14 ? "每兩週" : "每週";
  if (key === "allowance_weekday") return WEEKDAY_LABEL[Number(value)] ?? String(value);
  return `${value} 積木幣`;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });
}

export default async function ChildProgressPage({ params }: PageProps<"/family/children/[id]">) {
  const { user, db } = await requireParentArea();
  const { id } = await params;
  let data;
  try {
    data = await getChildProgress(db, user.id, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) redirect("/family");
    throw error;
  }
  const { child, progress, quests, goals, settings } = data;
  const active = goals.goals.filter((g) => g.status === "active");
  const topicsDone = quests.topics.filter((t) => t.done).length;

  return (
    <>
      <ParentTop mode="parent" showLogout />
      <main className="page grid gap-5">
        <Link className="link w-fit" href="/family">
          ← 回到家長區
        </Link>

        <section className="card kid-row">
          <Avatar avatarKey={child.avatarKey} />
          <div className="meta">
            <b>{child.displayName}</b>
            <span>
              {AGE_BAND_LABEL[child.ageBand]} · Lv.{progress.level} {progress.title}
            </span>
            <span className="mt-1 inline-flex items-center gap-1">
              <Coin />
              <span className="num">{data.balance}</span> 積木幣
            </span>
          </div>
          <form action={startPlayingAction}>
            <input type="hidden" name="childId" value={child.id} />
            <button className="btn btn-primary btn-sm" type="submit">
              <Icon name="play" />
              開始玩
            </button>
          </form>
        </section>

        <section className="card p-5">
          <h2 className="sec-title">學習進度</h2>
          <p className="mb-3 text-[14px] text-ink-2">這裡只看孩子學了什麼、做了哪些選擇，不做排名，也不用積木幣多寡評價孩子。</p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="stat">
              <small>完成的理財任務</small>
              <b>{quests.done}</b>
              <span>/ {quests.total}</span>
            </div>
            <div className="stat">
              <small>接觸過的主題</small>
              <b>{topicsDone}</b>
              <span>/ {quests.topics.length}</span>
            </div>
          </div>
          <div className="topic-chips mb-4">
            {quests.topics.map((t) =>
              t.done ? (
                <CategoryChip key={t.category} category={t.category} icon={CATEGORY_ICON[t.category]} />
              ) : (
                <span key={t.category} className="cat off">
                  <Icon name="lock" />
                  {t.label}
                </span>
              ),
            )}
          </div>
          <h3 className="mb-1 text-[15px] font-bold">最近的選擇</h3>
          {quests.recent.length ? (
            <ul className="log-list">
              {quests.recent.map((l, i) => (
                <li key={i}>
                  <CategoryChip category={l.category} />
                  <div>
                    <b>{l.title}</b>
                    <small>
                      選了：{l.label} · {when(l.completedAt)}
                      {l.rewarded ? "" : " · 再玩一次"}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-ink-2">還沒有完成任務。</p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="sec-title">親子聊聊</h2>
          <p className="mb-3 text-[14px] text-ink-2">從孩子最近玩過的任務挑的問題，沒有標準答案，聽聽孩子怎麼想。</p>
          <ul className="prompt-list">
            {data.prompts.map((p) => (
              <li key={p}>
                <Icon name="bulb" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="sec-title">儲蓄目標</h2>
          {goals.goals.length ? (
            <ul className="grid gap-3">
              {goals.goals.map((g) => (
                <li key={g.id} className="parent-goal">
                  <div className="flex items-baseline justify-between gap-2">
                    <b>{g.title}</b>
                    <span className="num text-[14px] text-ink-2">
                      {g.saved} / {g.target}
                      {g.status === "completed" ? " · 已達成" : ""}
                    </span>
                  </div>
                  <Bricks percent={(g.saved / g.target) * 100} label={`${g.title} 儲蓄進度`} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-ink-2">還沒有儲蓄目標。</p>
          )}
          {active.length < goals.maxActive ? (
            <details className="mt-4" open={!settings.allowChildGoals && !active.length}>
              <summary className="link cursor-pointer">幫孩子建立目標</summary>
              <div className="mt-3">
                <ParentGoalForm childId={child.id} options={goals.options} />
              </div>
            </details>
          ) : (
            <p className="mt-3 text-[14px] text-ink-2">已經有 {goals.maxActive} 個進行中的目標。</p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="sec-title">虛擬零用錢與權限</h2>
          <p className="mb-3 text-[14px] text-ink-2">
            {settings.allowanceEnabled && settings.nextPayday
              ? `下一次發放：${when(settings.nextPayday)}，${settings.allowanceAmount} 積木幣。`
              : "目前沒有定期零用錢。"}
            積木幣是遊戲裡的虛擬貨幣，不能換成真錢。
          </p>
          <SettingsForm childId={child.id} childName={child.displayName} settings={settings} />
          {data.settingsLog.length ? (
            <>
              <h3 className="mb-1 mt-5 text-[15px] font-bold">變更紀錄</h3>
              <ul className="change-log">
                {data.settingsLog.map((l, i) => (
                  <li key={i}>
                    <span>
                      {SETTING_LABEL[l.setting]}：{settingValue(l.setting, l.oldValue)} → {settingValue(l.setting, l.newValue)}
                    </span>
                    <small>
                      {l.actorName || "家長"} · {when(l.createdAt)}
                    </small>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="card px-5 py-3">
          <h2 className="sec-title mt-2">近期帳本</h2>
          <TxList items={data.recentTransactions} showBalance />
        </section>
      </main>
    </>
  );
}
