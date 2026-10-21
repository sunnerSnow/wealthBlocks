import { and, asc, eq, gt } from "drizzle-orm";
import type { Db } from "@/lib/db/local";
import { buildingDefinitions, children, gameProfiles, islandObjects, userInventory, virtualWallets } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import type { AgeBand, AvatarKey } from "@/lib/game/input";
import { type XpProgress, xpProgress } from "@/lib/game/levels";
import { type TxDto, listTransactionsForWallet } from "@/lib/services/ledger";
import { requireChildScope } from "@/lib/services/scope";

export interface IslandObjectDto {
  id: string;
  slug: string;
  name: string;
  assetKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isFlat: boolean;
  isMovable: boolean;
}

export interface InventoryItemDto {
  slug: string;
  name: string;
  assetKey: string;
  quantity: number;
}

export interface GameStateDto {
  child: { id: string; displayName: string; avatarKey: AvatarKey; ageBand: AgeBand };
  progress: XpProgress;
  balance: number;
  island: IslandObjectDto[];
  inventory: InventoryItemDto[];
  recentTransactions: TxDto[];
}

/** 孩子模式首頁需要的全部資料（只讀）；孩子必須屬於這個帳號的家庭 */
export async function getGameState(db: Db, userId: string, childId: string): Promise<GameStateDto> {
  return withUser(db, userId, async (tx) => {
    const scope = await requireChildScope(tx, userId, childId);
    const [child] = await tx
      .select({ id: children.id, displayName: children.displayName, avatarKey: children.avatarKey, ageBand: children.ageBand })
      .from(children)
      .where(and(eq(children.id, childId), eq(children.familyId, scope.familyId)));
    const [profile] = await tx
      .select({ experience: gameProfiles.experience })
      .from(gameProfiles)
      .where(and(eq(gameProfiles.id, scope.gameProfileId), eq(gameProfiles.familyId, scope.familyId)));
    const [wallet] = await tx
      .select({ balance: virtualWallets.balance })
      .from(virtualWallets)
      .where(and(eq(virtualWallets.id, scope.walletId), eq(virtualWallets.familyId, scope.familyId)));

    const island = await tx
      .select({
        id: islandObjects.id,
        slug: buildingDefinitions.slug,
        name: buildingDefinitions.name,
        assetKey: buildingDefinitions.assetKey,
        x: islandObjects.gridX,
        y: islandObjects.gridY,
        width: buildingDefinitions.width,
        height: buildingDefinitions.height,
        isFlat: buildingDefinitions.isFlat,
        isMovable: buildingDefinitions.isMovable,
      })
      .from(islandObjects)
      .innerJoin(buildingDefinitions, eq(buildingDefinitions.id, islandObjects.buildingDefinitionId))
      .where(and(eq(islandObjects.gameProfileId, scope.gameProfileId), eq(islandObjects.familyId, scope.familyId)))
      .orderBy(asc(islandObjects.gridY), asc(islandObjects.gridX));

    const inventory = await tx
      .select({ slug: buildingDefinitions.slug, name: buildingDefinitions.name, assetKey: buildingDefinitions.assetKey, quantity: userInventory.quantity })
      .from(userInventory)
      .innerJoin(buildingDefinitions, eq(buildingDefinitions.id, userInventory.buildingDefinitionId))
      .where(and(eq(userInventory.gameProfileId, scope.gameProfileId), eq(userInventory.familyId, scope.familyId), gt(userInventory.quantity, 0)))
      .orderBy(asc(buildingDefinitions.slug));

    return {
      child: { ...child, avatarKey: child.avatarKey as AvatarKey },
      progress: xpProgress(profile.experience),
      balance: wallet.balance,
      island,
      inventory,
      recentTransactions: await listTransactionsForWallet(tx, scope.familyId, scope.walletId, 5),
    };
  });
}

export async function getChildLedger(db: Db, userId: string, childId: string): Promise<{ balance: number; transactions: TxDto[] }> {
  return withUser(db, userId, async (tx) => {
    const scope = await requireChildScope(tx, userId, childId);
    const [wallet] = await tx
      .select({ balance: virtualWallets.balance })
      .from(virtualWallets)
      .where(and(eq(virtualWallets.id, scope.walletId), eq(virtualWallets.familyId, scope.familyId)));
    return { balance: wallet.balance, transactions: await listTransactionsForWallet(tx, scope.familyId, scope.walletId, 200) };
  });
}
