import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/local";
import { families, familyMembers, profiles } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { AppError, issuesFromZod, validationFailed } from "@/lib/errors";
import { PIN_LOCK_MINUTES, PIN_MAX_ATTEMPTS, hashPin, verifyPin } from "@/lib/auth/pin";
import { familySetupSchema, pinSchema } from "@/lib/game/input";
import { createChildTx } from "@/lib/services/children";
import { requireFamilyId } from "@/lib/services/scope";

export interface FamilyDto {
  id: string;
  name: string;
  parentName: string;
}

/** 第一次登入時建立個人資料 */
export async function ensureProfile(db: Db, userId: string): Promise<void> {
  await withUser(db, userId, (tx) => tx.insert(profiles).values({ id: userId }).onConflictDoNothing());
}

export async function getMyFamily(db: Db, userId: string): Promise<FamilyDto | null> {
  return withUser(db, userId, async (tx) => {
    const [row] = await tx
      .select({ id: families.id, name: families.name, parentName: profiles.displayName })
      .from(familyMembers)
      .innerJoin(families, eq(families.id, familyMembers.familyId))
      .innerJoin(profiles, eq(profiles.id, familyMembers.userId))
      .where(eq(familyMembers.userId, userId));
    return row ?? null;
  });
}

/** 建立家庭：家長稱呼、家長 PIN、第一位孩子（含遊戲檔案、錢包、初始積木幣、新手禮包）一次完成 */
export async function setupFamily(db: Db, userId: string, input: unknown): Promise<{ familyId: string; childId: string }> {
  const parsed = familySetupSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  const data = parsed.data;
  // scrypt 很花時間，放在交易外面算
  const pinHash = await hashPin(data.pin);

  return withUser(db, userId, async (tx) => {
    const [existing] = await tx.select({ familyId: familyMembers.familyId }).from(familyMembers).where(eq(familyMembers.userId, userId));
    if (existing) throw new AppError("family_exists", "你已經建立過家庭了", 409);

    await tx.update(profiles).set({ displayName: data.parentName }).where(eq(profiles.id, userId));
    const [family] = await tx
      .insert(families)
      .values({ name: data.familyName, createdBy: userId, parentPinHash: pinHash })
      .returning({ id: families.id });
    await tx.insert(familyMembers).values({ familyId: family.id, userId, role: "parent" });
    const childId = await createChildTx(tx, family.id, data.child);
    return { familyId: family.id, childId };
  });
}

export type PinCheck = { ok: true } | { ok: false; lockedUntil: string | null; attemptsLeft: number };

/**
 * 驗證家長 PIN。錯誤次數要寫回資料庫，所以結果用回傳值表示（交易照常提交），由呼叫端決定怎麼顯示。
 * 鎖住期間連正確的 PIN 也不接受。
 */
export async function checkParentPin(db: Db, userId: string, pin: unknown, now = new Date()): Promise<PinCheck> {
  const parsed = pinSchema.safeParse(pin);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));

  return withUser(db, userId, async (tx) => {
    const familyId = await requireFamilyId(tx, userId);
    const [family] = await tx
      .select({ hash: families.parentPinHash, attempts: families.pinFailedAttempts, lockedUntil: families.pinLockedUntil })
      .from(families)
      .where(eq(families.id, familyId))
      .for("update");
    if (!family?.hash) throw new AppError("pin_not_set", "這個家庭還沒有設定家長 PIN", 409);

    if (family.lockedUntil && new Date(family.lockedUntil) > now) {
      return { ok: false, lockedUntil: family.lockedUntil, attemptsLeft: 0 };
    }
    if (await verifyPin(parsed.data, family.hash)) {
      await tx.update(families).set({ pinFailedAttempts: 0, pinLockedUntil: null }).where(eq(families.id, familyId));
      return { ok: true };
    }
    const attempts = family.attempts + 1;
    if (attempts >= PIN_MAX_ATTEMPTS) {
      const lockedUntil = new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000).toISOString();
      await tx.update(families).set({ pinFailedAttempts: 0, pinLockedUntil: lockedUntil }).where(eq(families.id, familyId));
      return { ok: false, lockedUntil, attemptsLeft: 0 };
    }
    await tx.update(families).set({ pinFailedAttempts: attempts, pinLockedUntil: null }).where(eq(families.id, familyId));
    return { ok: false, lockedUntil: null, attemptsLeft: PIN_MAX_ATTEMPTS - attempts };
  });
}
