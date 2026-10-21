import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/local";
import { AppError } from "@/lib/errors";
import { INITIAL_GRANT, MAX_CHILDREN, STARTER_INVENTORY, STARTER_OBJECTS } from "@/lib/game/economy";
import { PIN_MAX_ATTEMPTS } from "@/lib/auth/pin";
import { addChild, listChildren } from "@/lib/services/children";
import { checkParentPin, getMyFamily, setupFamily } from "@/lib/services/family";
import { getChildLedger, getGameState } from "@/lib/services/game";
import { createFamily, createParent, createTestDb, SETUP } from "./helpers/db";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

describe("建立家庭與孩子", () => {
  it("一次建立家庭、家長、第一位孩子的完整初始狀態", async () => {
    const { userId, childId } = await createFamily(db);
    expect(await getMyFamily(db, userId)).toMatchObject({ name: "陳家", parentName: "媽媽" });

    const kids = await listChildren(db, userId);
    expect(kids).toEqual([
      { id: childId, displayName: "小安", avatarKey: "sun", ageBand: "9-10", level: 1, levelTitle: "積木新手", balance: INITIAL_GRANT },
    ]);

    const state = await getGameState(db, userId, childId);
    expect(state.balance).toBe(INITIAL_GRANT);
    expect(state.progress).toMatchObject({ level: 1, current: 0 });
    expect(state.island.map((o) => [o.slug, o.x, o.y])).toEqual(
      expect.arrayContaining(STARTER_OBJECTS.map((o) => [o.slug, o.x, o.y])),
    );
    expect(state.island).toHaveLength(STARTER_OBJECTS.length);
    expect(state.inventory.map((i) => [i.slug, i.quantity]).sort()).toEqual(STARTER_INVENTORY.map((i) => [i.slug, i.quantity]).sort());
    expect(state.recentTransactions).toEqual([
      expect.objectContaining({ type: "initial_grant", amount: INITIAL_GRANT, balanceAfter: INITIAL_GRANT }),
    ]);
  });

  it("同一個帳號不能建立第二個家庭，失敗時不會留下半套資料", async () => {
    const { userId } = await createFamily(db);
    const error = await setupFamily(db, userId, SETUP).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("family_exists");
    expect(await listChildren(db, userId)).toHaveLength(1);
  });

  it("輸入不合法時整個建立流程不會開始", async () => {
    const userId = await createParent(db);
    const error = await setupFamily(db, userId, { ...SETUP, child: { displayName: "", ageBand: "3-5" } }).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).issues.map((i) => i.field)).toEqual(expect.arrayContaining(["child.displayName", "child.ageBand"]));
    expect(await getMyFamily(db, userId)).toBeNull();
  });

  it("新增第二位孩子，各自有自己的錢包與初始積木幣", async () => {
    const { userId } = await createFamily(db);
    const second = await addChild(db, userId, { displayName: "小樂", ageBand: "6-8", avatarKey: "mint" });
    const kids = await listChildren(db, userId);
    expect(kids.map((k) => k.displayName)).toEqual(["小安", "小樂"]);
    expect((await getChildLedger(db, userId, second)).transactions).toHaveLength(1);
  });

  it(`一個家庭最多 ${MAX_CHILDREN} 位孩子`, async () => {
    const { userId } = await createFamily(db);
    for (let i = 1; i < MAX_CHILDREN; i++) await addChild(db, userId, { displayName: `孩子${i}`, ageBand: "6-8" });
    const error = await addChild(db, userId, { displayName: "太多了", ageBand: "6-8" }).catch((e) => e);
    expect((error as AppError).code).toBe("too_many_children");
  });

  it("錢包餘額等於帳本加總（每位孩子）", async () => {
    const { userId } = await createFamily(db);
    await addChild(db, userId, { displayName: "小樂", ageBand: "6-8" });
    const rows = await db.execute(sql`
      select w.balance, coalesce(sum(t.amount), 0)::bigint as total,
             (select t2.balance_after from wealth.virtual_transactions t2 where t2.wallet_id = w.id order by t2.seq desc limit 1) as last_after
      from wealth.virtual_wallets w left join wealth.virtual_transactions t on t.wallet_id = w.id
      group by w.id`);
    const list = (rows as unknown as { rows?: unknown[] }).rows ?? (rows as unknown as unknown[]);
    expect(list).toHaveLength(2);
    for (const r of list as { balance: string | number; total: string | number; last_after: string | number }[]) {
      expect(Number(r.balance)).toBe(Number(r.total));
      expect(Number(r.balance)).toBe(Number(r.last_after));
    }
  });
});

describe("家長 PIN", () => {
  it("正確的 PIN 通過；錯的會累計，達到上限就鎖住，鎖住期間正確的也不接受", async () => {
    const { userId } = await createFamily(db);
    const now = new Date("2026-10-21T10:00:00Z");
    expect(await checkParentPin(db, userId, "2580", now)).toEqual({ ok: true });

    for (let i = 1; i < PIN_MAX_ATTEMPTS; i++) {
      expect(await checkParentPin(db, userId, "0000", now)).toEqual({ ok: false, lockedUntil: null, attemptsLeft: PIN_MAX_ATTEMPTS - i });
    }
    const locked = await checkParentPin(db, userId, "0000", now);
    expect(locked).toMatchObject({ ok: false, attemptsLeft: 0 });
    expect(locked.ok === false && locked.lockedUntil).toBeTruthy();
    expect(await checkParentPin(db, userId, "2580", new Date(now.getTime() + 60_000))).toMatchObject({ ok: false, attemptsLeft: 0 });
    // 鎖定時間過後恢復
    expect(await checkParentPin(db, userId, "2580", new Date(now.getTime() + 11 * 60_000))).toEqual({ ok: true });
  });

  it("PIN 格式不對直接拒絕，不算一次錯誤", async () => {
    const { userId } = await createFamily(db);
    await expect(checkParentPin(db, userId, "12")).rejects.toBeInstanceOf(AppError);
    expect(await checkParentPin(db, userId, "0000")).toMatchObject({ attemptsLeft: PIN_MAX_ATTEMPTS - 1 });
  });
});
