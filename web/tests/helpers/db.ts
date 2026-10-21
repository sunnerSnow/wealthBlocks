import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { type Db, ensureLocalAuthUser, openLocalDb } from "@/lib/db/local";
import { ensureProfile, setupFamily } from "@/lib/services/family";

/** 記憶體內的 PGlite：跑 auth 模擬＋全部 migration，跟正式 schema 相同（含 RLS） */
export async function createTestDb(): Promise<Db> {
  return openLocalDb(new PGlite());
}

export async function createParent(db: Db): Promise<string> {
  const id = randomUUID();
  await ensureLocalAuthUser(db, id, `${id.slice(0, 8)}@example.test`);
  await ensureProfile(db, id);
  return id;
}

export const SETUP = {
  familyName: "陳家",
  parentName: "媽媽",
  pin: "2580",
  pinConfirm: "2580",
  child: { displayName: "小安", ageBand: "9-10", avatarKey: "sun" },
} as const;

/** 建立一位家長＋家庭＋第一位孩子 */
export async function createFamily(db: Db, overrides: Partial<Record<keyof typeof SETUP, unknown>> = {}) {
  const userId = await createParent(db);
  const { familyId, childId } = await setupFamily(db, userId, { ...SETUP, ...overrides });
  return { userId, familyId, childId };
}
