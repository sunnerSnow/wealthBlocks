import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/local";
import { AppError } from "@/lib/errors";
import { INITIAL_GRANT } from "@/lib/game/economy";
import { getChildLedger } from "@/lib/services/game";
import { contributeToGoal, createGoal, listGoals, withdrawFromGoal } from "@/lib/services/goals";
import { getIsland } from "@/lib/services/island";
import { completeQuest, getQuest, listLearningLog, listQuests } from "@/lib/services/quests";
import { equipWear, listShop, purchase } from "@/lib/services/shop";
import { createFamily, createTestDb } from "./helpers/db";

let db: Db;
let fam: Awaited<ReturnType<typeof createFamily>>;

beforeEach(async () => {
  db = await createTestDb();
  fam = await createFamily(db);
});

const rid = () => randomUUID();
const balance = async () => (await getChildLedger(db, fam.userId, fam.childId)).balance;
const quest = (slug: string, answer: object, requestId = rid()) => completeQuest(db, fam.userId, fam.childId, slug, { ...answer, requestId });
const buy = (slug: string, requestId = rid()) => purchase(db, fam.userId, fam.childId, { slug, requestId });

async function expectCode(p: Promise<unknown>, code: string) {
  const error = await p.then(
    () => null,
    (e) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
}

/** 每個錢包的餘額都等於帳本加總，也等於最後一筆的 balance_after */
async function expectLedgerConsistent() {
  const result = await db.execute(sql`
    select w.balance, coalesce(sum(t.amount), 0)::bigint as total,
           (select t2.balance_after from wealth.virtual_transactions t2 where t2.wallet_id = w.id order by t2.seq desc limit 1) as last_after
    from wealth.virtual_wallets w left join wealth.virtual_transactions t on t.wallet_id = w.id group by w.id`);
  const rows = ((result as unknown as { rows?: unknown[] }).rows ?? (result as unknown as unknown[])) as Record<string, unknown>[];
  for (const r of rows) {
    expect(Number(r.balance)).toBe(Number(r.total));
    expect(Number(r.balance)).toBe(Number(r.last_after));
  }
}

describe("理財任務", () => {
  it("第一次完成發積木幣與經驗值；重玩只記錄、不再發；同一個請求重送也不會多記", async () => {
    const first = await quest("toy-store", { choice: "C" });
    expect(first).toMatchObject({ rewarded: true, coins: 10, xp: 30, balance: INITIAL_GRANT + 10, label: "C. 暫時不買，存 70、留 30" });
    const again = await quest("toy-store", { choice: "A" });
    expect(again).toMatchObject({ rewarded: false, coins: 0, balance: INITIAL_GRANT + 10 });
    const requestId = rid();
    await quest("toy-store", { choice: "B" }, requestId);
    await quest("toy-store", { choice: "B" }, requestId);
    const log = await listLearningLog(db, fam.userId, fam.childId);
    expect(log.map((l) => [l.label.slice(0, 1), l.rewarded])).toEqual([["B", false], ["A", false], ["C", true]]);
    expect((await listQuests(db, fam.userId, fam.childId)).find((q) => q.slug === "toy-store")).toMatchObject({ status: "done", lastChoice: "B. 先不買，100 全部存起來" });
    await expectLedgerConsistent();
  });

  it("同時送出好幾次第一次完成，只發一次獎勵", async () => {
    await Promise.all([1, 2, 3].map(() => quest("bakery-helper", { choice: "A" }).catch((e) => e)));
    expect(await balance()).toBe(INITIAL_GRANT + 15);
    await expectLedgerConsistent();
  });

  it("答案由伺服器驗證：不存在的選項、分配加總不對、不是 5 的倍數都拒絕", async () => {
    await expectCode(quest("toy-store", { choice: "Z" }), "validation_failed");
    await expectCode(quest("toy-store", {}), "validation_failed");
    await expectCode(quest("three-jars", { alloc: { spend: 20, save: 20, share: 20 } }), "validation_failed");
    await expectCode(quest("three-jars", { alloc: { spend: 12, save: 30, share: 8 } }), "validation_failed");
    const ok = await quest("three-jars", { alloc: { spend: 15, save: 25, share: 10 } });
    expect(ok).toMatchObject({ rewarded: true, label: "花用 15、儲蓄 25、分享 10" });
    expect(await balance()).toBe(INITIAL_GRANT + 15);
  });

  it("等級不夠的任務不能玩也不能領獎；完成三個任務升到 Lv.2 並解鎖圖書館與新任務", async () => {
    await expectCode(getQuest(db, fam.userId, fam.childId, "rainy-day"), "quest_locked");
    await expectCode(quest("rainy-day", { choice: "A" }), "quest_locked");
    await quest("toy-store", { choice: "A" });
    await quest("bakery-helper", { choice: "B" });
    const third = await quest("three-jars", { alloc: { spend: 10, save: 30, share: 10 } });
    expect(third.levelUp).toMatchObject({
      level: 2,
      title: "小小建築師",
      unlocks: { items: [{ slug: "library" }], quests: [{ slug: "rainy-day" }] },
    });
    expect((await getQuest(db, fam.userId, fam.childId, "rainy-day")).status).toBe("open");
    expect((await listShop(db, fam.userId, fam.childId)).items.find((i) => i.slug === "library")?.status).not.toBe("locked");
  });
});

describe("商店", () => {
  it("價格由伺服器決定：扣款、記帳、放進收藏一次完成", async () => {
    const result = await buy("lamp");
    expect(result).toMatchObject({ balance: INITIAL_GRANT - 25, replayed: false });
    expect((await getIsland(db, fam.userId, fam.childId)).inventory.find((i) => i.slug === "lamp")?.quantity).toBe(1);
    const { transactions } = await getChildLedger(db, fam.userId, fam.childId);
    expect(transactions[0]).toMatchObject({ type: "purchase", amount: -25, description: "購買「路燈」" });
    await expectLedgerConsistent();
  });

  it("餘額不足時拒絕，餘額與收藏都不變", async () => {
    await expectCode(buy("shop"), "insufficient_balance");
    expect(await balance()).toBe(INITIAL_GRANT);
    expect((await getIsland(db, fam.userId, fam.childId)).inventory.some((i) => i.slug === "shop")).toBe(false);
  });

  it("同一個請求重送只扣一次；同時送出也只扣一次", async () => {
    const requestId = rid();
    await buy("tree", requestId);
    const again = await buy("tree", requestId);
    expect(again.replayed).toBe(true);
    const concurrent = rid();
    await Promise.all([buy("flower", concurrent), buy("flower", concurrent), buy("flower", concurrent)]);
    expect(await balance()).toBe(INITIAL_GRANT - 20 - 15);
    expect((await getIsland(db, fam.userId, fam.childId)).inventory.find((i) => i.slug === "flower")?.quantity).toBe(3);
    await expectLedgerConsistent();
  });

  it("限購商品買過就不能再買（包括同時送出兩個不同的請求）", async () => {
    await buy("hat-cap");
    await expectCode(buy("hat-cap"), "already_owned");
    const results = await Promise.all([buy("hat-explorer").catch((e) => e), buy("hat-explorer").catch((e) => e)]);
    expect(results.filter((r) => r instanceof AppError)).toHaveLength(1);
    expect(await balance()).toBe(INITIAL_GRANT - 25 - 30);
    await expectLedgerConsistent();
  });

  it("等級不夠的商品不能買", async () => {
    await expectCode(buy("library"), "item_locked");
  });

  it("造型：要先擁有才能戴；可以摘下", async () => {
    await expectCode(equipWear(db, fam.userId, fam.childId, { slug: "hat-cap" }), "not_owned");
    await buy("hat-cap");
    await equipWear(db, fam.userId, fam.childId, { slug: "hat-cap" });
    expect((await listShop(db, fam.userId, fam.childId)).items.find((i) => i.slug === "hat-cap")).toMatchObject({ status: "owned", equipped: true });
    await equipWear(db, fam.userId, fam.childId, { slug: null });
    expect((await listShop(db, fam.userId, fam.childId)).items.find((i) => i.slug === "hat-cap")?.equipped).toBe(false);
  });
});

describe("儲蓄目標", () => {
  it("目標金額由伺服器決定（夢想小屋 150）；存入、取回都記帳，存滿就把夢想小屋放進收藏", async () => {
    const goal = await createGoal(db, fam.userId, fam.childId, { reward: "house" });
    expect(goal).toMatchObject({ title: "夢想小屋", target: 150, saved: 0, status: "active", reward: { slug: "house" } });

    // 初始 100 不夠存滿 150：先完成四個任務（+10 +15 +15，升到 Lv.2 後再 +10）
    await quest("toy-store", { choice: "A" });
    await quest("bakery-helper", { choice: "A" });
    await quest("three-jars", { alloc: { spend: 10, save: 30, share: 10 } });
    await quest("rainy-day", { choice: "C" });
    expect(await balance()).toBe(150);

    const step1 = await contributeToGoal(db, fam.userId, fam.childId, goal.id, { amount: 80, requestId: rid() });
    expect(step1).toMatchObject({ balance: 70, completed: false, goal: { saved: 80 } });
    const back = await withdrawFromGoal(db, fam.userId, fam.childId, goal.id, { amount: 30, requestId: rid() });
    expect(back).toMatchObject({ balance: 100, goal: { saved: 50 } });
    await expectCode(contributeToGoal(db, fam.userId, fam.childId, goal.id, { amount: 101, requestId: rid() }), "validation_failed");
    const done = await contributeToGoal(db, fam.userId, fam.childId, goal.id, { amount: 100, requestId: rid() });
    expect(done).toMatchObject({ completed: true, goal: { saved: 150, status: "completed" } });
    expect((await getIsland(db, fam.userId, fam.childId)).inventory.find((i) => i.slug === "house")?.quantity).toBe(1);
    // 已經擁有，不能再設成目標
    expect((await listGoals(db, fam.userId, fam.childId)).options.some((o) => o.slug === "house")).toBe(false);
    await expectLedgerConsistent();
  });

  it("不能存超過錢包餘額或還差的金額；不能取回超過已存的；重送不會重複扣款", async () => {
    const goal = await createGoal(db, fam.userId, fam.childId, { reward: "pond" });
    expect(goal.target).toBe(60);
    await expectCode(contributeToGoal(db, fam.userId, fam.childId, goal.id, { amount: 61, requestId: rid() }), "validation_failed");
    await expectCode(withdrawFromGoal(db, fam.userId, fam.childId, goal.id, { amount: 1, requestId: rid() }), "validation_failed");
    const requestId = rid();
    await contributeToGoal(db, fam.userId, fam.childId, goal.id, { amount: 20, requestId });
    const again = await contributeToGoal(db, fam.userId, fam.childId, goal.id, { amount: 20, requestId });
    expect(again).toMatchObject({ replayed: true, goal: { saved: 20 }, balance: INITIAL_GRANT - 20 });

    const big = await createGoal(db, fam.userId, fam.childId, { title: "生日禮物", target: 500 });
    await expectCode(contributeToGoal(db, fam.userId, fam.childId, big.id, { amount: 81, requestId: rid() }), "insufficient_balance");
    await expectLedgerConsistent();
  });

  it("自訂目標金額有範圍；最多 3 個進行中目標；同一個獎勵不能同時有兩個目標", async () => {
    await expectCode(createGoal(db, fam.userId, fam.childId, { title: "太大", target: 9999 }), "validation_failed");
    await expectCode(createGoal(db, fam.userId, fam.childId, { title: "", target: 50 }), "validation_failed");
    await createGoal(db, fam.userId, fam.childId, { reward: "house" });
    await expectCode(createGoal(db, fam.userId, fam.childId, { reward: "house" }), "reward_unavailable");
    await createGoal(db, fam.userId, fam.childId, { reward: "shop" });
    await createGoal(db, fam.userId, fam.childId, { title: "腳踏車", target: 200 });
    await expectCode(createGoal(db, fam.userId, fam.childId, { title: "第四個", target: 50 }), "too_many_goals");
  });

  it("為限購建築存錢中直接買到了：目標結束，存的錢退回錢包", async () => {
    await quest("toy-store", { choice: "A" });
    await quest("bakery-helper", { choice: "A" });
    const goal = await createGoal(db, fam.userId, fam.childId, { reward: "shop" });
    await contributeToGoal(db, fam.userId, fam.childId, goal.id, { amount: 5, requestId: rid() });
    const result = await buy("shop");
    expect(result.refunded).toBe(5);
    expect(result.balance).toBe(INITIAL_GRANT + 10 + 15 - 120);
    expect((await listGoals(db, fam.userId, fam.childId)).goals.some((g) => g.id === goal.id)).toBe(false);
    await expectLedgerConsistent();
  });

  it("不能動別的家庭孩子的目標", async () => {
    const goal = await createGoal(db, fam.userId, fam.childId, { reward: "house" });
    const lin = await createFamily(db, { familyName: "林家", child: { displayName: "阿哲", ageBand: "11-12", avatarKey: "mint" } });
    await expectCode(contributeToGoal(db, lin.userId, lin.childId, goal.id, { amount: 10, requestId: rid() }), "not_found");
    await expectCode(withdrawFromGoal(db, lin.userId, lin.childId, goal.id, { amount: 10, requestId: rid() }), "not_found");
  });
});
