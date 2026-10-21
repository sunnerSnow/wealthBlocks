import { and, eq, sql } from "drizzle-orm";
import { gameProfiles, islandObjects, userInventory } from "@/lib/db/schema";
import type { Tx } from "@/lib/db/with-user";
import { levelForXp } from "@/lib/game/levels";
import type { ChildScope } from "@/lib/services/scope";

/** 收藏 +n（建築定義）；收藏列不存在就新增 */
export async function addBuildingToInventory(tx: Tx, scope: ChildScope, buildingDefinitionId: string, n = 1): Promise<void> {
  await tx
    .insert(userInventory)
    .values({ familyId: scope.familyId, gameProfileId: scope.gameProfileId, buildingDefinitionId, quantity: n })
    .onConflictDoUpdate({
      target: [userInventory.gameProfileId, userInventory.buildingDefinitionId],
      set: { quantity: sql`${userInventory.quantity} + ${n}` },
    });
}

/** 造型商品放進收藏（限購，所以數量固定 1） */
export async function addWearToInventory(tx: Tx, scope: ChildScope, shopItemId: string): Promise<void> {
  await tx
    .insert(userInventory)
    .values({ familyId: scope.familyId, gameProfileId: scope.gameProfileId, shopItemId, quantity: 1 })
    .onConflictDoNothing({ target: [userInventory.gameProfileId, userInventory.shopItemId] });
}

/** 擁有幾件：收藏裡還沒放的＋島上的 */
export async function ownedBuildingCount(tx: Tx, scope: ChildScope, buildingDefinitionId: string): Promise<number> {
  const [inv] = await tx
    .select({ n: userInventory.quantity })
    .from(userInventory)
    .where(
      and(
        eq(userInventory.gameProfileId, scope.gameProfileId),
        eq(userInventory.familyId, scope.familyId),
        eq(userInventory.buildingDefinitionId, buildingDefinitionId),
      ),
    );
  const [placed] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(islandObjects)
    .where(
      and(
        eq(islandObjects.gameProfileId, scope.gameProfileId),
        eq(islandObjects.familyId, scope.familyId),
        eq(islandObjects.buildingDefinitionId, buildingDefinitionId),
      ),
    );
  return (inv?.n ?? 0) + Number(placed?.n ?? 0);
}

export async function getExperience(tx: Tx, scope: ChildScope): Promise<{ experience: number; level: number; equippedShopItemId: string | null }> {
  const [row] = await tx
    .select({ experience: gameProfiles.experience, equippedShopItemId: gameProfiles.equippedShopItemId })
    .from(gameProfiles)
    .where(and(eq(gameProfiles.id, scope.gameProfileId), eq(gameProfiles.familyId, scope.familyId)));
  return { ...row, level: levelForXp(row.experience) };
}
