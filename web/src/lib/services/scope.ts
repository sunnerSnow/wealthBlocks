import { and, eq, isNull } from "drizzle-orm";
import { children, familyMembers, gameProfiles, virtualWallets } from "@/lib/db/schema";
import { type Tx, isUuid } from "@/lib/db/with-user";
import { notFound } from "@/lib/errors";

/** 目前帳號所屬的家庭 ID；還沒建立家庭時丟 404 */
export async function requireFamilyId(tx: Tx, userId: string): Promise<string> {
  const [member] = await tx.select({ familyId: familyMembers.familyId }).from(familyMembers).where(eq(familyMembers.userId, userId));
  if (!member) throw notFound("家庭");
  return member.familyId;
}

export interface ChildScope {
  familyId: string;
  childId: string;
  gameProfileId: string;
  walletId: string;
}

/**
 * 確認孩子屬於這個帳號的家庭，並取出遊戲檔案與錢包。
 * 別的家庭的孩子與不存在的孩子回同一個 404。
 */
export async function requireChildScope(tx: Tx, userId: string, childId: string): Promise<ChildScope> {
  if (!isUuid(childId)) throw notFound("孩子");
  const familyId = await requireFamilyId(tx, userId);
  const [row] = await tx
    .select({ gameProfileId: gameProfiles.id, walletId: virtualWallets.id })
    .from(children)
    .innerJoin(gameProfiles, and(eq(gameProfiles.childId, children.id), eq(gameProfiles.familyId, familyId)))
    .innerJoin(virtualWallets, and(eq(virtualWallets.gameProfileId, gameProfiles.id), eq(virtualWallets.familyId, familyId)))
    .where(and(eq(children.id, childId), eq(children.familyId, familyId), isNull(children.archivedAt)));
  if (!row) throw notFound("孩子");
  return { familyId, childId, ...row };
}

/** 鎖住孩子的遊戲檔案：同一個孩子的操作（放置、購買、存錢、領獎勵）在資料庫裡依序處理 */
export async function lockChildScope(tx: Tx, userId: string, childId: string): Promise<ChildScope> {
  const scope = await requireChildScope(tx, userId, childId);
  await tx
    .select({ id: gameProfiles.id })
    .from(gameProfiles)
    .where(and(eq(gameProfiles.id, scope.gameProfileId), eq(gameProfiles.familyId, scope.familyId)))
    .for("update");
  return scope;
}
