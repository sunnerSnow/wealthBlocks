import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/local";
import { buildingDefinitions, children, gameProfiles, islandObjects, userInventory, virtualWallets } from "@/lib/db/schema";
import { type Tx, withUser } from "@/lib/db/with-user";
import { AppError, issuesFromZod, validationFailed } from "@/lib/errors";
import { INITIAL_GRANT, MAX_CHILDREN, STARTER_INVENTORY, STARTER_OBJECTS, initialGrantKey } from "@/lib/game/economy";
import { type AgeBand, type AvatarKey, type ChildInput, childInputSchema } from "@/lib/game/input";
import { xpProgress } from "@/lib/game/levels";
import { postVirtualTransaction } from "@/lib/services/ledger";
import { requireFamilyId } from "@/lib/services/scope";

export interface ChildSummary {
  id: string;
  displayName: string;
  avatarKey: AvatarKey;
  ageBand: AgeBand;
  level: number;
  levelTitle: string;
  balance: number;
}

/**
 * 在呼叫端的交易內建立孩子的完整初始狀態：
 * 孩子檔案 → 遊戲檔案 → 錢包 → 初始積木幣（記帳）→ 島上的起始物件 → 新手禮包收藏。
 */
export async function createChildTx(tx: Tx, familyId: string, child: ChildInput): Promise<string> {
  const [row] = await tx
    .insert(children)
    .values({ familyId, displayName: child.displayName, ageBand: child.ageBand, avatarKey: child.avatarKey })
    .returning({ id: children.id });
  const [profile] = await tx.insert(gameProfiles).values({ familyId, childId: row.id }).returning({ id: gameProfiles.id });
  const [wallet] = await tx.insert(virtualWallets).values({ familyId, gameProfileId: profile.id }).returning({ id: virtualWallets.id });

  await postVirtualTransaction(tx, {
    familyId,
    walletId: wallet.id,
    type: "initial_grant",
    amount: INITIAL_GRANT,
    idempotencyKey: initialGrantKey(profile.id),
    description: "歡迎禮：初始積木幣",
  });

  const slugs = [...new Set([...STARTER_OBJECTS.map((o) => o.slug), ...STARTER_INVENTORY.map((i) => i.slug)])];
  const defs = await tx
    .select({ id: buildingDefinitions.id, slug: buildingDefinitions.slug })
    .from(buildingDefinitions)
    .where(inArray(buildingDefinitions.slug, slugs));
  const idOf = (slug: string) => {
    const def = defs.find((d) => d.slug === slug);
    if (!def) throw new Error(`缺少建築定義：${slug}`);
    return def.id;
  };
  await tx.insert(islandObjects).values(
    STARTER_OBJECTS.map((o) => ({ familyId, gameProfileId: profile.id, buildingDefinitionId: idOf(o.slug), gridX: o.x, gridY: o.y })),
  );
  await tx.insert(userInventory).values(
    STARTER_INVENTORY.map((i) => ({ familyId, gameProfileId: profile.id, buildingDefinitionId: idOf(i.slug), quantity: i.quantity })),
  );
  return row.id;
}

export async function addChild(db: Db, userId: string, input: unknown): Promise<string> {
  const parsed = childInputSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  return withUser(db, userId, async (tx) => {
    const familyId = await requireFamilyId(tx, userId);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(children)
      .where(and(eq(children.familyId, familyId), isNull(children.archivedAt)));
    if (total >= MAX_CHILDREN) throw new AppError("too_many_children", `一個家庭最多 ${MAX_CHILDREN} 位孩子`, 409);
    return createChildTx(tx, familyId, parsed.data);
  });
}

export async function listChildren(db: Db, userId: string): Promise<ChildSummary[]> {
  return withUser(db, userId, async (tx) => {
    const familyId = await requireFamilyId(tx, userId);
    const rows = await tx
      .select({
        id: children.id,
        displayName: children.displayName,
        avatarKey: children.avatarKey,
        ageBand: children.ageBand,
        experience: gameProfiles.experience,
        balance: virtualWallets.balance,
      })
      .from(children)
      .innerJoin(gameProfiles, and(eq(gameProfiles.childId, children.id), eq(gameProfiles.familyId, familyId)))
      .innerJoin(virtualWallets, and(eq(virtualWallets.gameProfileId, gameProfiles.id), eq(virtualWallets.familyId, familyId)))
      .where(and(eq(children.familyId, familyId), isNull(children.archivedAt)))
      .orderBy(asc(children.createdAt), asc(children.id));
    return rows.map(({ experience, ...r }) => {
      const p = xpProgress(experience);
      return { ...r, avatarKey: r.avatarKey as AvatarKey, level: p.level, levelTitle: p.title };
    });
  });
}
