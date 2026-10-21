import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/local";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { buildingDefinitions, gameProfiles, purchases, savingsGoals, shopItems, userInventory, virtualTransactions, virtualWallets } from "@/lib/db/schema";
import { type Tx, withUser } from "@/lib/db/with-user";
import { AppError, issuesFromZod, notFound, validationFailed } from "@/lib/errors";
import { addBuildingToInventory, addWearToInventory, getExperience, ownedBuildingCount } from "@/lib/services/inventory";
import { postVirtualTransaction } from "@/lib/services/ledger";
import { type ChildScope, lockChildScope, requireChildScope } from "@/lib/services/scope";

export type ShopStatus = "buy" | "poor" | "locked" | "owned";

export interface ShopItemDto {
  slug: string;
  name: string;
  description: string;
  category: "deco" | "building" | "terrain" | "wear";
  price: number;
  assetKey: string;
  isUnique: boolean;
  minLevel: number;
  /** 建築的佔地；造型商品是 null */
  size: { width: number; height: number } | null;
  status: ShopStatus;
  /** 已經擁有幾件（收藏＋島上；造型是 0 或 1） */
  owned: number;
  /** 造型是不是正戴著 */
  equipped: boolean;
  /** 有沒有為它存錢的進行中目標 */
  goal: { id: string; saved: number; target: number } | null;
}

export interface ShopDto {
  balance: number;
  level: number;
  items: ShopItemDto[];
}

export interface PurchaseDto {
  item: ShopItemDto;
  balance: number;
  /** 同一個請求編號重送：這次沒有再扣款 */
  replayed: boolean;
  /** 原本為它存的錢退回錢包的金額（限購商品買到後，目標自動結束） */
  refunded: number;
}

type ItemRow = typeof shopItems.$inferSelect & { width: number | null; height: number | null };

async function loadItems(tx: Tx): Promise<ItemRow[]> {
  return tx
    .select({
      id: shopItems.id,
      slug: shopItems.slug,
      name: shopItems.name,
      description: shopItems.description,
      category: shopItems.category,
      price: shopItems.price,
      assetKey: shopItems.assetKey,
      isActive: shopItems.isActive,
      isUnique: shopItems.isUnique,
      minLevel: shopItems.minLevel,
      buildingDefinitionId: shopItems.buildingDefinitionId,
      sortOrder: shopItems.sortOrder,
      width: buildingDefinitions.width,
      height: buildingDefinitions.height,
    })
    .from(shopItems)
    .leftJoin(buildingDefinitions, eq(buildingDefinitions.id, shopItems.buildingDefinitionId))
    .where(eq(shopItems.isActive, true))
    .orderBy(asc(shopItems.sortOrder));
}

async function ownedWear(tx: Tx, scope: ChildScope, shopItemId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: userInventory.id })
    .from(userInventory)
    .where(and(eq(userInventory.gameProfileId, scope.gameProfileId), eq(userInventory.familyId, scope.familyId), eq(userInventory.shopItemId, shopItemId)));
  return Boolean(row);
}

async function describe(tx: Tx, scope: ChildScope, item: ItemRow, balance: number, level: number, equipped: string | null): Promise<ShopItemDto> {
  const owned = item.buildingDefinitionId
    ? await ownedBuildingCount(tx, scope, item.buildingDefinitionId)
    : (await ownedWear(tx, scope, item.id))
      ? 1
      : 0;
  const status: ShopStatus =
    item.isUnique && owned > 0 ? "owned" : level < item.minLevel ? "locked" : balance < item.price ? "poor" : "buy";
  const [goal] = item.buildingDefinitionId
    ? await tx
        .select({ id: savingsGoals.id, saved: savingsGoals.savedAmount, target: savingsGoals.targetAmount })
        .from(savingsGoals)
        .where(
          and(
            eq(savingsGoals.gameProfileId, scope.gameProfileId),
            eq(savingsGoals.familyId, scope.familyId),
            eq(savingsGoals.rewardBuildingId, item.buildingDefinitionId),
            eq(savingsGoals.status, "active"),
          ),
        )
    : [];
  return {
    slug: item.slug,
    name: item.name,
    description: item.description,
    category: item.category,
    price: item.price,
    assetKey: item.assetKey,
    isUnique: item.isUnique,
    minLevel: item.minLevel,
    size: item.width && item.height ? { width: item.width, height: item.height } : null,
    status,
    owned,
    equipped: equipped === item.id,
    goal: goal ?? null,
  };
}

async function balanceOf(tx: Tx, scope: ChildScope): Promise<number> {
  const [wallet] = await tx
    .select({ balance: virtualWallets.balance })
    .from(virtualWallets)
    .where(and(eq(virtualWallets.id, scope.walletId), eq(virtualWallets.familyId, scope.familyId)));
  return wallet.balance;
}

export async function listShop(db: Db, userId: string, childId: string): Promise<ShopDto> {
  return withUser(db, userId, async (tx) => {
    const scope = await requireChildScope(tx, userId, childId);
    const balance = await balanceOf(tx, scope);
    const { level, equippedShopItemId } = await getExperience(tx, scope);
    const items = [];
    for (const item of await loadItems(tx)) items.push(await describe(tx, scope, item, balance, level, equippedShopItemId));
    return { balance, level, items };
  });
}

const purchaseSchema = z.object({ slug: z.string().min(1, "沒有這個商品"), requestId: z.uuid("請求編號格式不對") });

/**
 * 購買：價格、餘額、等級與限購都由伺服器檢查；扣款、購買紀錄、收藏在同一個交易內完成。
 * 同一個 requestId 重送只會扣一次款；限購商品另有資料庫唯一索引擋重複購買。
 */
export async function purchase(db: Db, userId: string, childId: string, input: unknown): Promise<PurchaseDto> {
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  const { slug, requestId } = parsed.data;

  try {
    return await withUser(db, userId, async (tx) => {
      const scope = await lockChildScope(tx, userId, childId);
      const item = (await loadItems(tx)).find((i) => i.slug === slug);
      if (!item) throw notFound("商品");
      const idempotencyKey = `purchase:${requestId}`;

      // 重送：之前已經處理過這個請求，直接回傳現況
      const [previous] = await tx
        .select({ id: virtualTransactions.id })
        .from(virtualTransactions)
        .where(and(eq(virtualTransactions.walletId, scope.walletId), eq(virtualTransactions.idempotencyKey, idempotencyKey)));
      const { level, equippedShopItemId } = await getExperience(tx, scope);
      if (previous) {
        const balance = await balanceOf(tx, scope);
        return { item: await describe(tx, scope, item, balance, level, equippedShopItemId), balance, replayed: true, refunded: 0 };
      }

      const before = await describe(tx, scope, item, await balanceOf(tx, scope), level, equippedShopItemId);
      if (before.status === "owned") throw new AppError("already_owned", `你已經有「${item.name}」了`, 409);
      if (before.status === "locked") throw new AppError("item_locked", `升到 Lv.${item.minLevel} 才能購買「${item.name}」`, 409);

      const posted = await postVirtualTransaction(tx, {
        familyId: scope.familyId,
        walletId: scope.walletId,
        type: "purchase",
        amount: -item.price,
        idempotencyKey,
        description: `購買「${item.name}」`,
        referenceType: "shop_item",
        referenceId: item.id,
      });
      await tx.insert(purchases).values({
        familyId: scope.familyId,
        gameProfileId: scope.gameProfileId,
        shopItemId: item.id,
        transactionId: posted.transaction.id,
        price: item.price,
        isUnique: item.isUnique,
      });
      if (item.buildingDefinitionId) await addBuildingToInventory(tx, scope, item.buildingDefinitionId);
      else await addWearToInventory(tx, scope, item.id);

      // 限購建築買到了：原本為它存錢的目標結束，存的錢退回錢包
      let refunded = 0;
      if (item.isUnique && item.buildingDefinitionId) {
        const [goal] = await tx
          .select({ id: savingsGoals.id, saved: savingsGoals.savedAmount, title: savingsGoals.title })
          .from(savingsGoals)
          .where(
            and(
              eq(savingsGoals.gameProfileId, scope.gameProfileId),
              eq(savingsGoals.familyId, scope.familyId),
              eq(savingsGoals.rewardBuildingId, item.buildingDefinitionId),
              eq(savingsGoals.status, "active"),
            ),
          );
        if (goal) {
          if (goal.saved > 0) {
            await postVirtualTransaction(tx, {
              familyId: scope.familyId,
              walletId: scope.walletId,
              type: "goal_withdrawal",
              amount: goal.saved,
              idempotencyKey: `goal-close:${goal.id}`,
              description: `目標「${goal.title}」結束，取回`,
              referenceType: "savings_goal",
              referenceId: goal.id,
            });
            refunded = goal.saved;
          }
          await tx.update(savingsGoals).set({ status: "archived", savedAmount: 0 }).where(eq(savingsGoals.id, goal.id));
        }
      }

      const balance = await balanceOf(tx, scope);
      return { item: await describe(tx, scope, item, balance, level, equippedShopItemId), balance, replayed: false, refunded };
    });
  } catch (error) {
    if (isUniqueViolation(error, "purchases_unique_item_uq")) throw new AppError("already_owned", "你已經有這個商品了", 409);
    throw error;
  }
}

const equipSchema = z.object({ slug: z.string().min(1).nullable() });

/** 戴上或摘下造型（slug 為 null 表示摘下）；只能戴自己擁有的 */
export async function equipWear(db: Db, userId: string, childId: string, input: unknown): Promise<{ equipped: string | null }> {
  const parsed = equipSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  return withUser(db, userId, async (tx) => {
    const scope = await lockChildScope(tx, userId, childId);
    let itemId: string | null = null;
    if (parsed.data.slug) {
      const item = (await loadItems(tx)).find((i) => i.slug === parsed.data.slug && i.category === "wear");
      if (!item || !(await ownedWear(tx, scope, item.id))) throw new AppError("not_owned", "要先擁有這個造型才能戴上", 409);
      itemId = item.id;
    }
    await tx
      .update(gameProfiles)
      .set({ equippedShopItemId: itemId })
      .where(and(eq(gameProfiles.id, scope.gameProfileId), eq(gameProfiles.familyId, scope.familyId)));
    return { equipped: parsed.data.slug };
  });
}
