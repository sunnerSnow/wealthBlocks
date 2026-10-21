import { and, asc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/local";
import { buildingDefinitions, gameProfiles, islandObjects, userInventory } from "@/lib/db/schema";
import { type Tx, isUuid, withUser } from "@/lib/db/with-user";
import { AppError, issuesFromZod, notFound, validationFailed } from "@/lib/errors";
import { GRID_SIZE, checkPlacement } from "@/lib/game/island";
import { type ChildScope, requireChildScope } from "@/lib/services/scope";

export interface BuildingDto {
  slug: string;
  name: string;
  assetKey: string;
  category: "building" | "deco" | "terrain" | "nature";
  description: string;
  /** 這種建築的取得方式（依建築定義，不是這一件從哪來）：新手禮包、島嶼原有、商店、儲蓄目標獎勵 */
  source: string;
  width: number;
  height: number;
  isFlat: boolean;
  isMovable: boolean;
}

export interface IslandObjectDto extends BuildingDto {
  id: string;
  x: number;
  y: number;
}

export interface InventoryItemDto extends BuildingDto {
  /** 收藏裡還沒放到島上的數量 */
  quantity: number;
}

export interface IslandStateDto {
  objects: IslandObjectDto[];
  inventory: InventoryItemDto[];
}

const SOURCE_LABEL: Record<string, string> = {
  starter: "新手禮包",
  island: "島嶼原有",
  shop: "商店",
  savings_goal: "儲蓄目標獎勵",
};

const buildingColumns = {
  slug: buildingDefinitions.slug,
  name: buildingDefinitions.name,
  assetKey: buildingDefinitions.assetKey,
  category: buildingDefinitions.category,
  description: buildingDefinitions.description,
  unlockRule: buildingDefinitions.unlockRule,
  width: buildingDefinitions.width,
  height: buildingDefinitions.height,
  isFlat: buildingDefinitions.isFlat,
  isMovable: buildingDefinitions.isMovable,
};

function withSource<T extends { unlockRule: unknown }>(row: T): Omit<T, "unlockRule"> & { source: string } {
  const { unlockRule, ...rest } = row;
  const source = (unlockRule as { source?: string } | null)?.source ?? "";
  return { ...rest, source: SOURCE_LABEL[source] ?? "" };
}

export async function loadIsland(tx: Tx, scope: ChildScope): Promise<IslandStateDto> {
  const objects = await tx
    .select({ id: islandObjects.id, x: islandObjects.gridX, y: islandObjects.gridY, ...buildingColumns })
    .from(islandObjects)
    .innerJoin(buildingDefinitions, eq(buildingDefinitions.id, islandObjects.buildingDefinitionId))
    .where(and(eq(islandObjects.gameProfileId, scope.gameProfileId), eq(islandObjects.familyId, scope.familyId)))
    .orderBy(asc(islandObjects.gridY), asc(islandObjects.gridX), asc(islandObjects.createdAt));
  const inventory = await tx
    .select({ quantity: userInventory.quantity, ...buildingColumns })
    .from(userInventory)
    .innerJoin(buildingDefinitions, eq(buildingDefinitions.id, userInventory.buildingDefinitionId))
    .where(and(eq(userInventory.gameProfileId, scope.gameProfileId), eq(userInventory.familyId, scope.familyId), gt(userInventory.quantity, 0)))
    .orderBy(asc(buildingDefinitions.category), asc(buildingDefinitions.slug));
  return { objects: objects.map(withSource), inventory: inventory.map(withSource) };
}

export async function getIsland(db: Db, userId: string, childId: string): Promise<IslandStateDto> {
  return withUser(db, userId, async (tx) => loadIsland(tx, await requireChildScope(tx, userId, childId)));
}

// ---------------------------------------------------------------------------
// 放置、移動、收回：都在同一個交易內鎖住孩子的遊戲檔案，同時送出的操作會依序處理
// ---------------------------------------------------------------------------

const coord = z.int("座標必須是整數").min(0, "超出島嶼範圍了").max(GRID_SIZE - 1, "超出島嶼範圍了");
const placeSchema = z.object({ slug: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/, "沒有這個建築"), x: coord, y: coord });
const moveSchema = z.object({ x: coord, y: coord });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  return parsed.data;
}

async function lockScope(tx: Tx, userId: string, childId: string): Promise<ChildScope> {
  const scope = await requireChildScope(tx, userId, childId);
  await tx
    .select({ id: gameProfiles.id })
    .from(gameProfiles)
    .where(and(eq(gameProfiles.id, scope.gameProfileId), eq(gameProfiles.familyId, scope.familyId)))
    .for("update");
  return scope;
}

/** 伺服器端再檢查一次放置規則（前端的預覽只是提示） */
async function assertPlaceable(tx: Tx, scope: ChildScope, candidate: { x: number; y: number; width: number; height: number }, ignoreId?: string) {
  const { objects } = await loadIsland(tx, scope);
  const check = checkPlacement(candidate, objects, ignoreId);
  if (check.ok) return;
  if (check.reason === "outside") throw new AppError("placement_outside", "超出島嶼範圍了，要放在綠色的土地上", 422);
  const other = objects.find((o) => o.id === check.withId);
  throw new AppError("placement_overlap", `和「${other?.name ?? "其他建築"}」重疊了，換個位置吧`, 409);
}

async function findObject(tx: Tx, scope: ChildScope, objectId: string) {
  if (!isUuid(objectId)) throw notFound("島上的物件");
  const [row] = await tx
    .select({ id: islandObjects.id, x: islandObjects.gridX, y: islandObjects.gridY, buildingDefinitionId: islandObjects.buildingDefinitionId, ...buildingColumns })
    .from(islandObjects)
    .innerJoin(buildingDefinitions, eq(buildingDefinitions.id, islandObjects.buildingDefinitionId))
    .where(and(eq(islandObjects.id, objectId), eq(islandObjects.gameProfileId, scope.gameProfileId), eq(islandObjects.familyId, scope.familyId)));
  if (!row) throw notFound("島上的物件");
  if (!row.isMovable) throw new AppError("not_movable", `「${row.name}」是島嶼原有的，不能移動`, 409);
  return row;
}

/** 從收藏拿一件放到島上：收藏數量減一、新增島上物件 */
export async function placeObject(db: Db, userId: string, childId: string, input: unknown): Promise<IslandStateDto> {
  const { slug, x, y } = parse(placeSchema, input);
  return withUser(db, userId, async (tx) => {
    const scope = await lockScope(tx, userId, childId);
    const [item] = await tx
      .select({ inventoryId: userInventory.id, quantity: userInventory.quantity, buildingId: buildingDefinitions.id, name: buildingDefinitions.name, width: buildingDefinitions.width, height: buildingDefinitions.height })
      .from(userInventory)
      .innerJoin(buildingDefinitions, eq(buildingDefinitions.id, userInventory.buildingDefinitionId))
      .where(and(eq(userInventory.gameProfileId, scope.gameProfileId), eq(userInventory.familyId, scope.familyId), eq(buildingDefinitions.slug, slug), eq(buildingDefinitions.isActive, true)));
    if (!item || item.quantity <= 0) throw new AppError("not_in_inventory", "收藏裡沒有這個東西了", 409);

    await assertPlaceable(tx, scope, { x, y, width: item.width, height: item.height });
    await tx.insert(islandObjects).values({ familyId: scope.familyId, gameProfileId: scope.gameProfileId, buildingDefinitionId: item.buildingId, gridX: x, gridY: y });
    await tx.update(userInventory).set({ quantity: sql`${userInventory.quantity} - 1` }).where(eq(userInventory.id, item.inventoryId));
    return loadIsland(tx, scope);
  });
}

/** 移動島上的物件（不會花積木幣） */
export async function moveObject(db: Db, userId: string, childId: string, objectId: string, input: unknown): Promise<IslandStateDto> {
  const { x, y } = parse(moveSchema, input);
  return withUser(db, userId, async (tx) => {
    const scope = await lockScope(tx, userId, childId);
    const obj = await findObject(tx, scope, objectId);
    await assertPlaceable(tx, scope, { x, y, width: obj.width, height: obj.height }, obj.id);
    await tx.update(islandObjects).set({ gridX: x, gridY: y }).where(eq(islandObjects.id, obj.id));
    return loadIsland(tx, scope);
  });
}

/** 把島上的物件收回收藏 */
export async function storeObject(db: Db, userId: string, childId: string, objectId: string): Promise<IslandStateDto> {
  return withUser(db, userId, async (tx) => {
    const scope = await lockScope(tx, userId, childId);
    const obj = await findObject(tx, scope, objectId);
    await tx.delete(islandObjects).where(eq(islandObjects.id, obj.id));
    await tx
      .insert(userInventory)
      .values({ familyId: scope.familyId, gameProfileId: scope.gameProfileId, buildingDefinitionId: obj.buildingDefinitionId, quantity: 1 })
      .onConflictDoUpdate({
        target: [userInventory.gameProfileId, userInventory.buildingDefinitionId],
        set: { quantity: sql`${userInventory.quantity} + 1` },
      });
    return loadIsland(tx, scope);
  });
}
