import Link from "next/link";
import { BlockArt } from "@/components/art/block-art";
import { Bricks } from "@/components/game/bricks";
import { Icon } from "@/components/icons";
import type { GoalDto } from "@/lib/services/goals";

export function GoalArt({ goal, className }: { goal: GoalDto; className: "gcard-art" | "gmini-art" }) {
  const done = goal.status === "completed";
  return (
    <div className={`${className} ${done ? "" : "locked"}`}>
      {goal.reward ? <BlockArt asset={goal.reward.assetKey} /> : <Icon name="piggy" className="ic big" />}
      {className === "gcard-art" && !done && goal.reward ? (
        <span className="lockdot">
          <Icon name="lock" />
        </span>
      ) : null}
    </div>
  );
}

/** 首頁與右側欄的目標小卡（存入在「目標」頁操作） */
export function GoalMini({ goal }: { goal: GoalDto }) {
  const pct = (goal.saved / goal.target) * 100;
  return (
    <div className="card gmini">
      <GoalArt goal={goal} className="gmini-art" />
      <div className="gmini-body">
        <b>{goal.title}</b>
        <Bricks percent={pct} label={`${goal.title} 儲蓄進度`} />
        <small>
          <span className="num">
            {goal.saved} / {goal.target}
          </span>{" "}
          · 還差 {goal.target - goal.saved}
        </small>
      </div>
      <Link className="btn btn-primary btn-sm" href="/play/goals">
        存入
      </Link>
    </div>
  );
}

/** 最接近完成的進行中目標 */
export function topGoal(goals: GoalDto[]): GoalDto | null {
  return goals.filter((g) => g.status === "active").sort((a, b) => b.saved / b.target - a.saved / a.target)[0] ?? null;
}
