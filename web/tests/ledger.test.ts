import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/local";
import { withUser } from "@/lib/db/with-user";
import { AppError } from "@/lib/errors";
import { INITIAL_GRANT } from "@/lib/game/economy";
import { getChildLedger } from "@/lib/services/game";
import { postVirtualTransaction } from "@/lib/services/ledger";
import { requireChildScope } from "@/lib/services/scope";
import { createFamily, createTestDb } from "./helpers/db";

let db: Db;
let fam: Awaited<ReturnType<typeof createFamily>>;

beforeEach(async () => {
  db = await createTestDb();
  fam = await createFamily(db);
});

/** 以家長身分、在一個交易內對孩子的錢包記一筆 */
function post(type: Parameters<typeof postVirtualTransaction>[1]["type"], amount: number, key: string) {
  return withUser(db, fam.userId, async (tx) => {
    const scope = await requireChildScope(tx, fam.userId, fam.childId);
    return postVirtualTransaction(tx, { familyId: scope.familyId, walletId: scope.walletId, type, amount, idempotencyKey: key, description: "測試" });
  });
}

const balance = async () => (await getChildLedger(db, fam.userId, fam.childId)).balance;

describe("虛擬帳本", () => {
  it("收入與支出都記帳，並更新餘額快照", async () => {
    const reward = await post("quest_reward", 15, "quest-1-reward");
    expect(reward).toMatchObject({ replayed: false, transaction: { amount: 15, balanceAfter: INITIAL_GRANT + 15 } });
    const spend = await post("purchase", -20, "purchase-tree-1");
    expect(spend.transaction.balanceAfter).toBe(INITIAL_GRANT - 5);
    expect(await balance()).toBe(INITIAL_GRANT - 5);
    const { transactions } = await getChildLedger(db, fam.userId, fam.childId);
    expect(transactions.map((t) => t.amount)).toEqual([-20, 15, INITIAL_GRANT]);
  });

  it("餘額不足時拒絕，餘額與帳本都不變", async () => {
    const error = await post("purchase", -(INITIAL_GRANT + 1), "purchase-too-much").catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("insufficient_balance");
    expect(await balance()).toBe(INITIAL_GRANT);
    expect((await getChildLedger(db, fam.userId, fam.childId)).transactions).toHaveLength(1);
  });

  it("同一個請求編號重送不會重複發獎勵或重複扣款", async () => {
    const first = await post("quest_reward", 10, "quest-toy-store-reward");
    const again = await post("quest_reward", 10, "quest-toy-store-reward");
    expect(again.replayed).toBe(true);
    expect(again.transaction.id).toBe(first.transaction.id);
    await post("purchase", -25, "purchase-lamp-1");
    await post("purchase", -25, "purchase-lamp-1");
    expect(await balance()).toBe(INITIAL_GRANT + 10 - 25);
  });

  it("同時送出同一個請求，只會記一次", async () => {
    await Promise.all([post("quest_reward", 10, "same-key"), post("quest_reward", 10, "same-key"), post("quest_reward", 10, "same-key")]);
    expect(await balance()).toBe(INITIAL_GRANT + 10);
  });

  it("請求編號被拿去用在不同內容時拒絕", async () => {
    await post("quest_reward", 10, "reused-key");
    const error = await post("quest_reward", 99, "reused-key").catch((e) => e);
    expect((error as AppError).code).toBe("idempotency_conflict");
  });

  it("數量為 0、正負號不對、不是整數都拒絕", async () => {
    for (const [type, amount] of [["quest_reward", 0], ["purchase", 5], ["quest_reward", -5], ["allowance", 1.5]] as const) {
      const error = await post(type, amount, `bad-${type}-${amount}`).catch((e) => e);
      expect(error).toBeInstanceOf(AppError);
    }
    expect(await balance()).toBe(INITIAL_GRANT);
  });

  it("資料庫層：帳本不能改也不能刪，餘額不能是負數", async () => {
    const update = withUser(db, fam.userId, (tx) => tx.execute(sql`update wealth.virtual_transactions set amount = 9999`));
    await expect(update).rejects.toThrow();
    const remove = withUser(db, fam.userId, (tx) => tx.execute(sql`delete from wealth.virtual_transactions`));
    await expect(remove).rejects.toThrow();
    const negative = withUser(db, fam.userId, (tx) => tx.execute(sql`update wealth.virtual_wallets set balance = -1`));
    await expect(negative).rejects.toThrow();
    expect(await balance()).toBe(INITIAL_GRANT);
  });
});
