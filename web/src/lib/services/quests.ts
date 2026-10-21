import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/local";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { gameProfiles, questCompletions, quests, shopItems, virtualWallets } from "@/lib/db/schema";
import { type Tx, withUser } from "@/lib/db/with-user";
import { AppError, issuesFromZod, notFound, validationFailed } from "@/lib/errors";
import { type XpProgress, levelForXp, xpProgress } from "@/lib/game/levels";
import { type QuestCategory, type QuestContent, answerSchema, questContentSchema, questResult } from "@/lib/game/quests";
import { getExperience } from "@/lib/services/inventory";
import { postVirtualTransaction } from "@/lib/services/ledger";
import { type ChildScope, lockChildScope, requireChildScope } from "@/lib/services/scope";

export type QuestStatus = "open" | "done" | "locked";

export interface QuestSummaryDto {
  slug: string;
  title: string;
  category: QuestCategory;
  description: string;
  minLevel: number;
  rewardCoins: number;
  rewardXp: number;
  status: QuestStatus;
  /** 最近一次的選擇（還沒玩過是 null） */
  lastChoice: string | null;
}

export interface QuestDetailDto extends QuestSummaryDto {
  content: QuestContent;
}

export interface LevelUpDto {
  level: number;
  title: string;
  unlocks: { items: { slug: string; name: string; assetKey: string }[]; quests: { slug: string; title: string; category: QuestCategory }[] };
}

export interface QuestCompletionDto {
  slug: string;
  label: string;
  /** 第一次完成才有獎勵；重玩只記錄選擇 */
  rewarded: boolean;
  coins: number;
  xp: number;
  balance: number;
  progress: XpProgress;
  levelUp: LevelUpDto | null;
}

export interface LearningLogDto {
  slug: string;
  title: string;
  category: QuestCategory;
  label: string;
  rewarded: boolean;
  reflect: string;
  completedAt: string;
}

async function summaries(tx: Tx, scope: ChildScope): Promise<(QuestSummaryDto & { id: string; content: unknown })[]> {
  const { level } = await getExperience(tx, scope);
  const rows = await tx.select().from(quests).where(eq(quests.isActive, true)).orderBy(asc(quests.sortOrder), asc(quests.slug));
  const done = await tx
    .select({ questId: questCompletions.questId, rewarded: questCompletions.rewarded, label: questCompletions.selectedOption })
    .from(questCompletions)
    .where(and(eq(questCompletions.gameProfileId, scope.gameProfileId), eq(questCompletions.familyId, scope.familyId)))
    .orderBy(desc(questCompletions.completedAt));
  return rows.map((q) => {
    const mine = done.filter((d) => d.questId === q.id);
    const status: QuestStatus = level < q.minLevel ? "locked" : mine.some((d) => d.rewarded) ? "done" : "open";
    return {
      id: q.id,
      slug: q.slug,
      title: q.title,
      category: q.category,
      description: q.description,
      minLevel: q.minLevel,
      rewardCoins: q.rewardCoins,
      rewardXp: q.rewardXp,
      status,
      lastChoice: mine[0]?.label ?? null,
      content: q.contentJson,
    };
  });
}

function toSummary(q: QuestSummaryDto): QuestSummaryDto {
  const { slug, title, category, description, minLevel, rewardCoins, rewardXp, status, lastChoice } = q;
  return { slug, title, category, description, minLevel, rewardCoins, rewardXp, status, lastChoice };
}

export async function listQuests(db: Db, userId: string, childId: string): Promise<QuestSummaryDto[]> {
  return withUser(db, userId, async (tx) => {
    const list = await summaries(tx, await requireChildScope(tx, userId, childId));
    return list.map(toSummary);
  });
}

export async function getQuest(db: Db, userId: string, childId: string, slug: string): Promise<QuestDetailDto> {
  return withUser(db, userId, async (tx) => {
    const q = (await summaries(tx, await requireChildScope(tx, userId, childId))).find((x) => x.slug === slug);
    if (!q) throw notFound("任務");
    if (q.status === "locked") throw new AppError("quest_locked", `升到 Lv.${q.minLevel} 才能挑戰這個任務`, 409);
    return { ...toSummary(q), content: questContentSchema.parse(q.content) };
  });
}

/** 等級從 before 升到 after 時新解鎖的商品與任務 */
async function unlocksBetween(tx: Tx, before: number, after: number): Promise<LevelUpDto["unlocks"]> {
  const items = await tx
    .select({ slug: shopItems.slug, name: shopItems.name, assetKey: shopItems.assetKey })
    .from(shopItems)
    .where(and(eq(shopItems.isActive, true), gt(shopItems.minLevel, before), lte(shopItems.minLevel, after)))
    .orderBy(asc(shopItems.sortOrder));
  const qs = await tx
    .select({ slug: quests.slug, title: quests.title, category: quests.category })
    .from(quests)
    .where(and(eq(quests.isActive, true), gt(quests.minLevel, before), lte(quests.minLevel, after)))
    .orderBy(asc(quests.sortOrder));
  return { items, quests: qs };
}

const completeSchema = answerSchema.extend({ requestId: z.uuid("請求編號格式不對") });

/**
 * 完成任務：伺服器驗證答案、算出結果；第一次完成才發積木幣與經驗值（同一個任務的獎勵帳本編號固定，
 * 不管重送幾次、同時送幾次都只會發一次）。重玩只記錄選擇，給學習紀錄用。
 */
export async function completeQuest(db: Db, userId: string, childId: string, slug: string, input: unknown, retry = true): Promise<QuestCompletionDto> {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  const { requestId, ...answer } = parsed.data;

  try {
    return await withUser(db, userId, async (tx) => {
      const scope = await lockChildScope(tx, userId, childId);
      const [quest] = await tx.select().from(quests).where(and(eq(quests.slug, slug), eq(quests.isActive, true)));
      if (!quest) throw notFound("任務");
      const before = await getExperience(tx, scope);
      if (before.level < quest.minLevel) throw new AppError("quest_locked", `升到 Lv.${quest.minLevel} 才能挑戰這個任務`, 409);

      const result = questResult(questContentSchema.parse(quest.contentJson), answer);
      if (!result) throw validationFailed([{ field: "answer", message: "還沒選好答案，或分配的數量不對" }]);

      const [replay] = await tx
        .select({ rewarded: questCompletions.rewarded })
        .from(questCompletions)
        .where(and(eq(questCompletions.gameProfileId, scope.gameProfileId), eq(questCompletions.requestId, requestId)));
      const [already] = await tx
        .select({ id: questCompletions.id })
        .from(questCompletions)
        .where(and(eq(questCompletions.gameProfileId, scope.gameProfileId), eq(questCompletions.questId, quest.id), eq(questCompletions.rewarded, true)));

      let rewarded = false;
      let experience = before.experience;
      if (replay) {
        rewarded = replay.rewarded;
      } else {
        let rewardTransactionId: string | null = null;
        if (!already) {
          rewarded = true;
          if (quest.rewardCoins > 0) {
            const posted = await postVirtualTransaction(tx, {
              familyId: scope.familyId,
              walletId: scope.walletId,
              type: "quest_reward",
              amount: quest.rewardCoins,
              idempotencyKey: `quest-reward:${quest.id}`,
              description: `任務獎勵「${quest.title}」`,
              referenceType: "quest",
              referenceId: quest.id,
            });
            rewardTransactionId = posted.transaction.id;
          }
          experience = before.experience + quest.rewardXp;
          await tx
            .update(gameProfiles)
            .set({ experience, level: levelForXp(experience) })
            .where(and(eq(gameProfiles.id, scope.gameProfileId), eq(gameProfiles.familyId, scope.familyId)));
        }
        await tx.insert(questCompletions).values({
          familyId: scope.familyId,
          gameProfileId: scope.gameProfileId,
          questId: quest.id,
          selectedOption: result.label.slice(0, 60),
          resultJson: { answer, label: result.label },
          rewardTransactionId,
          rewarded,
          requestId,
        });
      }

      const [wallet] = await tx
        .select({ balance: virtualWallets.balance })
        .from(virtualWallets)
        .where(and(eq(virtualWallets.id, scope.walletId), eq(virtualWallets.familyId, scope.familyId)));
      const afterLevel = levelForXp(experience);
      const progress = xpProgress(experience);
      return {
        slug,
        label: result.label,
        rewarded,
        coins: rewarded ? quest.rewardCoins : 0,
        xp: rewarded ? quest.rewardXp : 0,
        balance: wallet.balance,
        progress,
        levelUp:
          !replay && afterLevel > before.level
            ? { level: afterLevel, title: progress.title, unlocks: await unlocksBetween(tx, before.level, afterLevel) }
            : null,
      };
    });
  } catch (error) {
    // 兩個請求同時第一次完成同一個任務：後到的那個撞到唯一索引，整筆交易已經還原，改成重玩處理
    if (retry && isUniqueViolation(error, "quest_completions_rewarded_uq")) {
      return completeQuest(db, userId, childId, slug, input, false);
    }
    throw error;
  }
}

export async function listLearningLog(db: Db, userId: string, childId: string, limit = 20): Promise<LearningLogDto[]> {
  return withUser(db, userId, async (tx) => {
    const scope = await requireChildScope(tx, userId, childId);
    const rows = await tx
      .select({
        slug: quests.slug,
        title: quests.title,
        category: quests.category,
        label: questCompletions.selectedOption,
        rewarded: questCompletions.rewarded,
        content: quests.contentJson,
        completedAt: questCompletions.completedAt,
      })
      .from(questCompletions)
      .innerJoin(quests, eq(quests.id, questCompletions.questId))
      .where(and(eq(questCompletions.gameProfileId, scope.gameProfileId), eq(questCompletions.familyId, scope.familyId)))
      .orderBy(desc(questCompletions.completedAt))
      .limit(limit);
    return rows.map(({ content, ...r }) => ({ ...r, reflect: (content as { reflect?: string }).reflect ?? "" }));
  });
}

/** 島嶼首頁用：下一個可以挑戰的任務 */
export function nextOpenQuest(list: QuestSummaryDto[]): QuestSummaryDto | null {
  return list.find((q) => q.status === "open") ?? null;
}
