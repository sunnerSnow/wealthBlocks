import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/local";
import { withUser } from "@/lib/db/with-user";
import { AppError } from "@/lib/errors";
import { addChild, listChildren } from "@/lib/services/children";
import { getMyFamily } from "@/lib/services/family";
import { getChildLedger, getGameState } from "@/lib/services/game";
import { postVirtualTransaction } from "@/lib/services/ledger";
import { requireChildScope } from "@/lib/services/scope";
import { createFamily, createParent, createTestDb } from "./helpers/db";

let db: Db;
let chen: Awaited<ReturnType<typeof createFamily>>;
let lin: Awaited<ReturnType<typeof createFamily>>;

beforeEach(async () => {
  db = await createTestDb();
  chen = await createFamily(db);
  lin = await createFamily(db, { familyName: "林家", child: { displayName: "阿哲", ageBand: "11-12", avatarKey: "mint" } });
});

async function expectNotFound(p: Promise<unknown>) {
  const error = await p.then(
    () => null,
    (e) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).status).toBe(404);
}

/** 以某位家長的身分直接查資料庫（繞過服務層），只剩 RLS 在擋 */
async function rawCount(userId: string, table: string): Promise<number> {
  const result = await withUser(db, userId, (tx) => tx.execute(sql.raw(`select count(*)::int as n from wealth.${table}`)));
  const rows = (result as unknown as { rows?: { n: number }[] }).rows ?? (result as unknown as { n: number }[]);
  return Number(rows[0].n);
}

describe("跨家庭存取：服務層", () => {
  it("只看得到自己家庭的孩子", async () => {
    expect((await listChildren(db, chen.userId)).map((k) => k.displayName)).toEqual(["小安"]);
    expect((await listChildren(db, lin.userId)).map((k) => k.displayName)).toEqual(["阿哲"]);
  });

  it("讀不到別的家庭孩子的遊戲狀態與帳本（回 404，不透露是否存在）", async () => {
    await expectNotFound(getGameState(db, lin.userId, chen.childId));
    await expectNotFound(getChildLedger(db, lin.userId, chen.childId));
    await expectNotFound(getGameState(db, lin.userId, "not-a-uuid"));
  });

  it("不能對別的家庭孩子的錢包記帳", async () => {
    const attempt = withUser(db, lin.userId, async (tx) => {
      const scope = await requireChildScope(tx, lin.userId, chen.childId);
      return postVirtualTransaction(tx, { ...scope, type: "quest_reward", amount: 999, idempotencyKey: "steal-coins", description: "偷" });
    });
    await expectNotFound(attempt);
  });

  it("還沒建立家庭的帳號什麼都看不到", async () => {
    const stranger = await createParent(db);
    expect(await getMyFamily(db, stranger)).toBeNull();
    await expectNotFound(listChildren(db, stranger));
    await expectNotFound(addChild(db, stranger, { displayName: "偷偷", ageBand: "6-8" }));
  });
});

describe("跨家庭存取：資料庫 RLS", () => {
  const tables = ["families", "family_members", "children", "game_profiles", "virtual_wallets", "virtual_transactions", "island_objects", "user_inventory"];

  it("直接查表也只看得到自己家庭的資料", async () => {
    for (const t of tables) {
      const result = await db.execute(sql.raw(`select count(*)::int as n from wealth.${t}`));
      const all = Number(((result as unknown as { rows?: { n: number }[] }).rows ?? (result as unknown as { n: number }[]))[0].n);
      const own = await rawCount(chen.userId, t);
      const other = await rawCount(lin.userId, t);
      expect(own, t).toBeGreaterThan(0);
      expect(other, t).toBeGreaterThan(0);
      // 兩個家庭各自只看得到自己那一份，加起來剛好是全部
      expect(own + other, t).toBe(all);
    }
    const stranger = await createParent(db);
    for (const t of tables) expect(await rawCount(stranger, t), t).toBe(0);
  });

  it("不能把資料寫進別的家庭", async () => {
    const intoChildren = withUser(db, lin.userId, (tx) =>
      tx.execute(sql`insert into wealth.children (family_id, display_name, age_band) values (${chen.familyId}, '入侵', '6-8')`),
    );
    await expect(intoChildren).rejects.toThrow();
    const joinFamily = withUser(db, lin.userId, (tx) =>
      tx.execute(sql`insert into wealth.family_members (family_id, user_id, role) values (${chen.familyId}, ${lin.userId}, 'parent')`),
    );
    await expect(joinFamily).rejects.toThrow();
    const stranger = await createParent(db);
    const sneakIn = withUser(db, stranger, (tx) =>
      tx.execute(sql`insert into wealth.family_members (family_id, user_id, role) values (${chen.familyId}, ${stranger}, 'parent')`),
    );
    await expect(sneakIn).rejects.toThrow();
  });

  it("改不到別的家庭的錢包", async () => {
    await withUser(db, lin.userId, (tx) => tx.execute(sql`update wealth.virtual_wallets set balance = 99999 where family_id = ${chen.familyId}`));
    expect((await getChildLedger(db, chen.userId, chen.childId)).balance).toBe(100);
  });

  it("主檔只能讀，不能改價格", async () => {
    expect(await rawCount(chen.userId, "shop_items")).toBeGreaterThan(0);
    const change = withUser(db, chen.userId, (tx) => tx.execute(sql`update wealth.shop_items set price = 1`));
    await expect(change).rejects.toThrow();
  });
});
