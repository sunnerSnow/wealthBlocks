import Link from "next/link";
import { Coin } from "@/components/brand";
import { Icon, type IconName } from "@/components/icons";
import { CATEGORY_LABEL, type QuestCategory } from "@/lib/game/quests";
import type { QuestSummaryDto } from "@/lib/services/quests";

export const CATEGORY_ICON: Record<QuestCategory, IconName> = {
  earn: "coins",
  spend: "bag",
  save: "piggy",
  plan: "pie",
  share: "heart",
  risk: "sprout",
};

export function CategoryChip({ category, icon }: { category: QuestCategory; icon?: IconName }) {
  return (
    <span className={`cat cat-${category}`}>
      <Icon name={icon ?? CATEGORY_ICON[category]} />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

export function QuestCard({ quest }: { quest: QuestSummaryDto }) {
  const { status } = quest;
  return (
    <article className={`qcard c-${quest.category} ${status}`}>
      <div className="qcard-top">
        <CategoryChip category={quest.category} />
        {status === "done" ? (
          <span className="qstate done">
            <Icon name="check" />
            已完成
          </span>
        ) : status === "locked" ? (
          <span className="qstate locked">
            <Icon name="lock" />
            Lv.{quest.minLevel} 解鎖
          </span>
        ) : null}
      </div>
      <h3>{quest.title}</h3>
      <p>{quest.description}</p>
      {quest.lastChoice ? <p className="qcard-note">你選了：{quest.lastChoice}</p> : null}
      <div className="qcard-foot">
        <span className="rewards">
          {status === "done" ? (
            <span className="rw done">
              <Icon name="check" />
              獎勵已領取
            </span>
          ) : (
            <>
              <span className="rw">
                <Icon name="star" />+{quest.rewardXp} 經驗
              </span>
              <span className="rw">
                <Coin />+{quest.rewardCoins}
              </span>
            </>
          )}
        </span>
        {status === "locked" ? (
          <button className="btn btn-sm" type="button" disabled>
            還沒解鎖
          </button>
        ) : (
          <Link className={`btn btn-sm ${status === "open" ? "btn-primary" : ""}`} href={`/play/quests/${quest.slug}`}>
            {status === "open" ? "開始挑戰" : "再玩一次"}
          </Link>
        )}
      </div>
    </article>
  );
}
