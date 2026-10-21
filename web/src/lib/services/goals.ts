import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/local";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { buildingDefinitions, savingsGoals, shopItems, virtualTransactions, virtualWallets } from "@/lib/db/schema";
import { type Tx, isUuid, withUser } from "@/lib/db/with-user";
import { AppError, issuesFromZod, notFound, validationFailed } from "@/lib/errors";
import { addBuildingToInventory, getExperience, ownedBuildingCount } from "@/lib/services/inventory";
import { postVirtualTransaction } from "@/lib/services/ledger";
import { type ChildScope, lockChildScope, requireChildScope } from "@/lib/services/scope";
import { readSettings } from "@/lib/services/settings";

export const MAX_ACTIVE_GOALS = 3;

export interface GoalRewardDto {
  slug: string;
  name: string;
  assetKey: string;
}

export interface GoalDto {
  id: string;
  title: string;
  target: number;
  saved: number;
  status: "active" | "completed" | "archived";
  reward: GoalRewardDto | null;
  completedAt: string | null;
}

export interface GoalOptionDto extends GoalRewardDto {
  /** 目標金額（伺服器決定：夢想小屋看建築設定，其他看商品價格） */
  target: number;
}

export interface GoalsDto {
  balance: number;
  goals: GoalDto[];
  /** 可以拿來當目標獎勵的建築 */
  options: GoalOptionDto[];
  maxActive: number;
  /** 孩子能不能自己建立目標（家長在家長中心設定；不能時由家長建立） */
  canCreate: boolean;
}

export interface GoalMoveDto {
  goal: GoalDto;
  balance: number;
  /** 這次存入剛好達成目標，獎勵已放進收藏 */
  completed: boolean;
  replayed: boolean;
}

async function balanceOf(tx: Tx, scope: ChildScope): Promise<number> {
  const [wallet] = await tx
    .select({ balance: virtualWallets.balance })
    .from(virtualWallets)
    .where(and(eq(virtualWallets.id, scope.walletId), eq(virtualWallets.familyId, scope.familyId)));
  return wallet.balance;
}

async function loadGoals(tx: Tx, scope: ChildScope, onlyId?: string): Promise<GoalDto[]> {
  const rows = await tx
    .select({
      id: savingsGoals.id,
      title: savingsGoals.title,
      target: savingsGoals.targetAmount,
      saved: savingsGoals.savedAmount,
      status: savingsGoals.status,
      completedAt: savingsGoals.completedAt,
      rewardSlug: buildingDefinitions.slug,
      rewardName: buildingDefinitions.name,
      rewardAsset: buildingDefinitions.assetKey,
    })
    .from(savingsGoals)
    .leftJoin(buildingDefinitions, eq(buildingDefinitions.id, savingsGoals.rewardBuildingId))
    .where(
      and(
        eq(savingsGoals.gameProfileId, scope.gameProfileId),
        eq(savingsGoals.familyId, scope.familyId),
        onlyId ? eq(savingsGoals.id, onlyId) : ne(savingsGoals.status, "archived"),
      ),
    )
    .orderBy(asc(savingsGoals.status), desc(savingsGoals.createdAt));
  return rows.map(({ rewardSlug, rewardName, rewardAsset, ...g }) => ({
    ...g,
    reward: rewardSlug && rewardName && rewardAsset ? { slug: rewardSlug, name: rewardName, assetKey: rewardAsset } : null,
  }));
}

/**
 * 可以當目標獎勵的建築與目標金額：
 * - 只能靠儲蓄目標取得的建築（夢想小屋），金額寫在建築設定的 goal_target
 * - 商店裡的建築與地形（等級夠才行），金額就是售價
 * 限購而且已經擁有的、已經有進行中目標的，不列出。
 */
async function rewardOptions(tx: Tx, scope: ChildScope): Promise<(GoalOptionDto & { buildingId: string })[]> {
  const { level } = await getExperience(tx, scope);
  const goalOnly = await tx
    .select({ buildingId: buildingDefinitions.id, slug: buildingDefinitions.slug, name: buildingDefinitions.name, assetKey: buildingDefinitions.assetKey, rule: buildingDefinitions.unlockRule })
    .from(buildingDefinitions)
    .where(and(eq(buildingDefinitions.isActive, true), sql`${buildingDefinitions.unlockRule} ->> 'source' = 'savings_goal'`));
  const fromShop = await tx
    .select({ buildingId: buildingDefinitions.id, slug: buildingDefinitions.slug, name: buildingDefinitions.name, assetKey: buildingDefinitions.assetKey, target: shopItems.price, isUnique: shopItems.isUnique, minLevel: shopItems.minLevel })
    .from(shopItems)
    .innerJoin(buildingDefinitions, eq(buildingDefinitions.id, shopItems.buildingDefinitionId))
    .where(and(eq(shopItems.isActive, true), inArray(shopItems.category, ["building", "terrain"])))
    .orderBy(asc(shopItems.sortOrder));
  const active = await tx
    .select({ buildingId: savingsGoals.rewardBuildingId })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.gameProfileId, scope.gameProfileId), eq(savingsGoals.familyId, scope.familyId), eq(savingsGoals.status, "active")));
  const taken = new Set(active.map((a) => a.buildingId));

  const options: (GoalOptionDto & { buildingId: string })[] = [];
  for (const g of goalOnly) {
    const target = Number((g.rule as { goal_target?: number }).goal_target);
    if (!Number.isSafeInteger(target) || target <= 0 || taken.has(g.buildingId)) continue;
    if ((await ownedBuildingCount(tx, scope, g.buildingId)) > 0) continue;
    options.push({ buildingId: g.buildingId, slug: g.slug, name: g.name, assetKey: g.assetKey, target });
  }
  for (const s of fromShop) {
    if (level < s.minLevel || taken.has(s.buildingId)) continue;
    if (s.isUnique && (await ownedBuildingCount(tx, scope, s.buildingId)) > 0) continue;
    options.push({ buildingId: s.buildingId, slug: s.slug, name: s.name, assetKey: s.assetKey, target: s.target });
  }
  return options;
}

export async function listGoals(db: Db, userId: string, childId: string): Promise<GoalsDto> {
  return withUser(db, userId, async (tx) => {
    const scope = await requireChildScope(tx, userId, childId);
    return {
      balance: await balanceOf(tx, scope),
      goals: await loadGoals(tx, scope),
      options: (await rewardOptions(tx, scope)).map((o) => ({ slug: o.slug, name: o.name, assetKey: o.assetKey, target: o.target })),
      maxActive: MAX_ACTIVE_GOALS,
      canCreate: (await readSettings(tx, scope)).allowChildGoals,
    };
  });
}

const createSchema = z.union([
  z.object({ reward: z.string().min(1) }),
  z.object({
    reward: z.null().optional(),
    title: z.string().trim().min(1, "請輸入目標名稱").max(12, "目標名稱最多 12 個字"),
    target: z.int("目標金額要是整數").min(10, "目標金額至少 10 積木幣").max(500, "目標金額最多 500 積木幣"),
  }),
]);

/**
 * 建立目標：獎勵建築的目標金額由伺服器決定；自訂目標（沒有獎勵）才能自己填金額。
 * byParent：家長在家長中心幫孩子建立（呼叫端要先確認是家長模式）；孩子自己建立時要看家長的設定。
 */
export async function createGoal(db: Db, userId: string, childId: string, input: unknown, opts: { byParent?: boolean } = {}): Promise<GoalDto> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  const data = parsed.data;
  try {
    return await withUser(db, userId, async (tx) => {
      const scope = await lockChildScope(tx, userId, childId);
      if (!opts.byParent && !(await readSettings(tx, scope)).allowChildGoals) {
        throw new AppError("goals_by_parent", "目前由家長幫你設定儲蓄目標，可以跟家長討論想存什麼", 403);
      }
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(savingsGoals)
        .where(and(eq(savingsGoals.gameProfileId, scope.gameProfileId), eq(savingsGoals.familyId, scope.familyId), eq(savingsGoals.status, "active")));
      if (Number(n) >= MAX_ACTIVE_GOALS) throw new AppError("too_many_goals", `一次最多 ${MAX_ACTIVE_GOALS} 個進行中的目標`, 409);

      let values: { title: string; targetAmount: number; rewardBuildingId: string | null };
      if (data.reward) {
        const option = (await rewardOptions(tx, scope)).find((o) => o.slug === data.reward);
        if (!option) throw new AppError("reward_unavailable", "這個獎勵現在不能設成目標（可能已經擁有，或已經在存了）", 409);
        values = { title: option.name, targetAmount: option.target, rewardBuildingId: option.buildingId };
      } else {
        const custom = data as { title: string; target: number };
        values = { title: custom.title, targetAmount: custom.target, rewardBuildingId: null };
      }
      const [row] = await tx
        .insert(savingsGoals)
        .values({ familyId: scope.familyId, gameProfileId: scope.gameProfileId, ...values })
        .returning({ id: savingsGoals.id });
      return (await loadGoals(tx, scope, row.id))[0];
    });
  } catch (error) {
    if (isUniqueViolation(error, "savings_goals_active_reward_uq")) throw new AppError("reward_unavailable", "已經在為這個獎勵存錢了", 409);
    throw error;
  }
}

const moveSchema = z.object({
  amount: z.int("數量要是整數").positive("數量要大於 0"),
  requestId: z.uuid("請求編號格式不對"),
});

async function findGoal(tx: Tx, scope: ChildScope, goalId: string) {
  if (!isUuid(goalId)) throw notFound("儲蓄目標");
  const [goal] = await tx
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.gameProfileId, scope.gameProfileId), eq(savingsGoals.familyId, scope.familyId)))
    .for("update");
  if (!goal) throw notFound("儲蓄目標");
  return goal;
}

async function alreadyHandled(tx: Tx, scope: ChildScope, key: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: virtualTransactions.id })
    .from(virtualTransactions)
    .where(and(eq(virtualTransactions.walletId, scope.walletId), eq(virtualTransactions.idempotencyKey, key)));
  return Boolean(row);
}

/**
 * 存入目標：錢包扣款與目標金額在同一個交易內更新。不能超過錢包餘額，也不能超過還差的金額。
 * 剛好存滿就完成目標，獎勵建築放進收藏。同一個 requestId 重送不會再扣一次。
 */
export async function contributeToGoal(db: Db, userId: string, childId: string, goalId: string, input: unknown): Promise<GoalMoveDto> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  const { amount, requestId } = parsed.data;
  return withUser(db, userId, async (tx) => {
    const scope = await lockChildScope(tx, userId, childId);
    const goal = await findGoal(tx, scope, goalId);
    const key = `goal-in:${requestId}`;
    if (await alreadyHandled(tx, scope, key)) {
      return { goal: (await loadGoals(tx, scope, goal.id))[0], balance: await balanceOf(tx, scope), completed: false, replayed: true };
    }
    if (goal.status !== "active") throw new AppError("goal_closed", "這個目標已經結束了", 409);
    const remaining = goal.targetAmount - goal.savedAmount;
    if (amount > remaining) throw validationFailed([{ field: "amount", message: `最多只要再存 ${remaining} 積木幣` }]);

    await postVirtualTransaction(tx, {
      familyId: scope.familyId,
      walletId: scope.walletId,
      type: "goal_contribution",
      amount: -amount,
      idempotencyKey: key,
      description: `存入「${goal.title}」`,
      referenceType: "savings_goal",
      referenceId: goal.id,
    });
    const saved = goal.savedAmount + amount;
    const completed = saved === goal.targetAmount;
    await tx
      .update(savingsGoals)
      .set(completed ? { savedAmount: saved, status: "completed", completedAt: new Date().toISOString() } : { savedAmount: saved })
      .where(eq(savingsGoals.id, goal.id));
    if (completed && goal.rewardBuildingId) await addBuildingToInventory(tx, scope, goal.rewardBuildingId);
    return { goal: (await loadGoals(tx, scope, goal.id))[0], balance: await balanceOf(tx, scope), completed, replayed: false };
  });
}

/** 從目標取回：不會有任何處罰；不能取回超過已存的金額 */
export async function withdrawFromGoal(db: Db, userId: string, childId: string, goalId: string, input: unknown): Promise<GoalMoveDto> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  const { amount, requestId } = parsed.data;
  return withUser(db, userId, async (tx) => {
    const scope = await lockChildScope(tx, userId, childId);
    const goal = await findGoal(tx, scope, goalId);
    const key = `goal-out:${requestId}`;
    if (await alreadyHandled(tx, scope, key)) {
      return { goal: (await loadGoals(tx, scope, goal.id))[0], balance: await balanceOf(tx, scope), completed: false, replayed: true };
    }
    if (goal.status !== "active") throw new AppError("goal_closed", "這個目標已經結束了", 409);
    if (amount > goal.savedAmount) throw validationFailed([{ field: "amount", message: `最多可以取回 ${goal.savedAmount} 積木幣` }]);

    await postVirtualTransaction(tx, {
      familyId: scope.familyId,
      walletId: scope.walletId,
      type: "goal_withdrawal",
      amount,
      idempotencyKey: key,
      description: `從「${goal.title}」取回`,
      referenceType: "savings_goal",
      referenceId: goal.id,
    });
    await tx.update(savingsGoals).set({ savedAmount: goal.savedAmount - amount }).where(eq(savingsGoals.id, goal.id));
    return { goal: (await loadGoals(tx, scope, goal.id))[0], balance: await balanceOf(tx, scope), completed: false, replayed: false };
  });
}
