import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/local";
import { children, gameProfiles, shopItems, virtualWallets } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import type { AgeBand, AvatarKey } from "@/lib/game/input";
import { type XpProgress, xpProgress } from "@/lib/game/levels";
import { type InventoryItemDto, type IslandObjectDto, loadIsland } from "@/lib/services/island";
import { type TxDto, listTransactionsForWallet } from "@/lib/services/ledger";
import { requireChildScope } from "@/lib/services/scope";

export interface GameStateDto {
  child: { id: string; displayName: string; avatarKey: AvatarKey; ageBand: AgeBand };
  progress: XpProgress;
  balance: number;
  /** 正戴著的造型素材代號（沒戴是 null） */
  equippedWear: string | null;
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
      .select({ experience: gameProfiles.experience, equippedWear: shopItems.assetKey })
      .from(gameProfiles)
      .leftJoin(shopItems, eq(shopItems.id, gameProfiles.equippedShopItemId))
      .where(and(eq(gameProfiles.id, scope.gameProfileId), eq(gameProfiles.familyId, scope.familyId)));
    const [wallet] = await tx
      .select({ balance: virtualWallets.balance })
      .from(virtualWallets)
      .where(and(eq(virtualWallets.id, scope.walletId), eq(virtualWallets.familyId, scope.familyId)));

    const { objects: island, inventory } = await loadIsland(tx, scope);

    return {
      child: { ...child, avatarKey: child.avatarKey as AvatarKey },
      progress: xpProgress(profile.experience),
      balance: wallet.balance,
      equippedWear: profile.equippedWear ?? null,
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
