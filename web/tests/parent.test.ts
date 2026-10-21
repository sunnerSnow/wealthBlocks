import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/local";
import { withUser } from "@/lib/db/with-user";
import { AppError } from "@/lib/errors";
import { INITIAL_GRANT } from "@/lib/game/economy";
import { duePeriods, firstPayday, MAX_CATCH_UP, nextPayday } from "@/lib/game/allowance";
import { discussionPrompts } from "@/lib/game/discussion";
import { getChildLedger } from "@/lib/services/game";
import { createGoal, listGoals } from "@/lib/services/goals";
import { getChildProgress } from "@/lib/services/progress";
import { completeQuest } from "@/lib/services/quests";
import { getChildSettings, listSettingsLog, settleAllowance, updateChildSettings } from "@/lib/services/settings";
import { createFamily, createTestDb } from "./helpers/db";

const DAY = 86_400_000;
// 2026-10-21 是星期三；台北 10:00 = UTC 02:00
const WED = new Date("2026-10-21T02:00:00Z");

describe("零用錢的發放時間", () => {
  it("第一次是之後最近的那個星期幾、台北時間 08:00", () => {
    expect(firstPayday(WED, 6).toISOString()).toBe("2026-10-24T00:00:00.000Z"); // 星期六
    expect(firstPayday(WED, 3).toISOString()).toBe("2026-10-28T00:00:00.000Z"); // 今天 08:00 已過 → 下週三
    expect(firstPayday(new Date("2026-10-20T23:00:00Z"), 3).toISOString()).toBe("2026-10-21T00:00:00.000Z"); // 星期三 07:00 → 當天 08:00
  });

  it("到期才發；同一期不重複；很久沒打開最多補發幾期", () => {
    const anchor = new Date("2026-10-24T00:00:00Z");
    expect(duePeriods(anchor, 7, new Date(anchor.getTime() - 1), -1)).toEqual([]);
    expect(duePeriods(anchor, 7, anchor, -1)).toEqual([0]);
    expect(duePeriods(anchor, 7, new Date(anchor.getTime() + 15 * DAY), -1)).toEqual([0, 1, 2]);
    expect(duePeriods(anchor, 7, new Date(anchor.getTime() + 15 * DAY), 2)).toEqual([]);
    expect(duePeriods(anchor, 14, new Date(anchor.getTime() + 15 * DAY), 0)).toEqual([1]);
    expect(duePeriods(anchor, 7, new Date(anchor.getTime() + 70 * DAY), -1)).toHaveLength(MAX_CATCH_UP);
    expect(nextPayday(anchor, 7, new Date(anchor.getTime() + DAY)).toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });
});

describe("家長設定與零用錢", () => {
  let db: Db;
  let fam: Awaited<ReturnType<typeof createFamily>>;
  const settings = (over: object = {}) => ({ allowanceEnabled: true, allowanceAmount: 30, allowanceInterval: 7, allowanceWeekday: 6, allowChildGoals: true, ...over });
  const balance = async () => (await getChildLedger(db, fam.userId, fam.childId)).balance;

  beforeEach(async () => {
    db = await createTestDb();
    fam = await createFamily(db);
  });

  it("預設沒有零用錢；啟用後到發放日才入帳，重複結算或同時結算都只入帳一次", async () => {
    expect(await getChildSettings(db, fam.userId, fam.childId, WED)).toMatchObject({ allowanceEnabled: false, nextPayday: null, allowChildGoals: true });
    const s = await updateChildSettings(db, fam.userId, fam.childId, settings(), WED);
    expect(s.nextPayday).toBe("2026-10-24T00:00:00.000Z");

    expect(await settleAllowance(db, fam.userId, fam.childId, new Date("2026-10-23T23:59:00Z"))).toBe(0);
    const sat = new Date("2026-10-24T03:00:00Z");
    expect(await settleAllowance(db, fam.userId, fam.childId, sat)).toBe(1);
    expect(await settleAllowance(db, fam.userId, fam.childId, sat)).toBe(0);
    await Promise.all([1, 2, 3].map(() => settleAllowance(db, fam.userId, fam.childId, new Date("2026-10-31T03:00:00Z"))));
    expect(await balance()).toBe(INITIAL_GRANT + 60);
    const { transactions } = await getChildLedger(db, fam.userId, fam.childId);
    expect(transactions.filter((t) => t.type === "allowance").map((t) => t.description)).toEqual(["每週零用錢", "每週零用錢"]);
  });

  it("很久沒打開：最多補發 4 期；停用期間不補發", async () => {
    await updateChildSettings(db, fam.userId, fam.childId, settings(), WED);
    expect(await settleAllowance(db, fam.userId, fam.childId, new Date(WED.getTime() + 70 * DAY))).toBe(MAX_CATCH_UP);
    await updateChildSettings(db, fam.userId, fam.childId, settings({ allowanceEnabled: false }), new Date(WED.getTime() + 71 * DAY));
    // 停用 4 週後再啟用：從啟用後的下一個發放日重新起算
    const back = new Date(WED.getTime() + 100 * DAY);
    await updateChildSettings(db, fam.userId, fam.childId, settings(), back);
    expect(await settleAllowance(db, fam.userId, fam.childId, back)).toBe(0);
    expect(await balance()).toBe(INITIAL_GRANT + MAX_CATCH_UP * 30);
  });

  it("只改金額：之後每期照新金額，不重新起算", async () => {
    await updateChildSettings(db, fam.userId, fam.childId, settings(), WED);
    await settleAllowance(db, fam.userId, fam.childId, new Date("2026-10-24T03:00:00Z"));
    const after = await updateChildSettings(db, fam.userId, fam.childId, settings({ allowanceAmount: 50 }), new Date("2026-10-25T03:00:00Z"));
    expect(after.nextPayday).toBe("2026-10-31T00:00:00.000Z");
    await settleAllowance(db, fam.userId, fam.childId, new Date("2026-10-31T03:00:00Z"));
    expect(await balance()).toBe(INITIAL_GRANT + 30 + 50);
  });

  it("金額與週期的範圍由伺服器檢查", async () => {
    for (const bad of [{ allowanceAmount: 0 }, { allowanceAmount: 1000 }, { allowanceInterval: 30 }, { allowanceWeekday: 7 }, { allowanceAmount: 12.5 }]) {
      await expect(updateChildSettings(db, fam.userId, fam.childId, settings(bad), WED)).rejects.toBeInstanceOf(AppError);
    }
  });

  it("每一次變更都記下時間、操作者與前後的值，紀錄不能修改", async () => {
    await updateChildSettings(db, fam.userId, fam.childId, settings(), WED);
    await updateChildSettings(db, fam.userId, fam.childId, settings({ allowanceAmount: 40, allowChildGoals: false }), WED);
    const log = await listSettingsLog(db, fam.userId, fam.childId);
    expect(log.find((l) => l.setting === "allowance_amount" && l.newValue === 40)).toMatchObject({ oldValue: 30, actorName: "媽媽" });
    expect(log.find((l) => l.setting === "allow_child_goals")).toMatchObject({ oldValue: true, newValue: false });
    expect(log.filter((l) => l.setting === "allowance_enabled")).toHaveLength(1);
    const tamper = withUser(db, fam.userId, (tx) => tx.execute(sql`update wealth.parent_settings_log set new_value = '999'::jsonb`));
    await expect(tamper).rejects.toThrow();
  });

  it("關掉「孩子自己建立目標」：孩子不能建，家長可以幫孩子建", async () => {
    await updateChildSettings(db, fam.userId, fam.childId, settings({ allowanceEnabled: false, allowChildGoals: false }), WED);
    expect((await listGoals(db, fam.userId, fam.childId)).canCreate).toBe(false);
    const error = await createGoal(db, fam.userId, fam.childId, { reward: "house" }).catch((e) => e);
    expect((error as AppError).code).toBe("goals_by_parent");
    const goal = await createGoal(db, fam.userId, fam.childId, { reward: "house" }, { byParent: true });
    expect(goal).toMatchObject({ title: "夢想小屋", target: 150 });
  });

  it("別的家庭不能讀或改孩子的設定與進度", async () => {
    const lin = await createFamily(db, { familyName: "林家", child: { displayName: "阿哲", ageBand: "11-12", avatarKey: "mint" } });
    for (const p of [
      getChildSettings(db, lin.userId, fam.childId),
      updateChildSettings(db, lin.userId, fam.childId, settings()),
      settleAllowance(db, lin.userId, fam.childId),
      getChildProgress(db, lin.userId, fam.childId),
      listSettingsLog(db, lin.userId, fam.childId),
    ]) {
      const error = await p.catch((e) => e);
      expect((error as AppError).status).toBe(404);
    }
    const raw = await withUser(db, lin.userId, (tx) => tx.execute(sql`select count(*)::int as n from wealth.child_settings`));
    const rows = (raw as unknown as { rows?: { n: number }[] }).rows ?? (raw as unknown as { n: number }[]);
    expect(Number(rows[0].n)).toBe(0);
  });
});

describe("家長看的學習進度", () => {
  it("彙整完成的任務、接觸過的主題、最近的選擇與親子討論題目，並先發放到期的零用錢", async () => {
    const db = await createTestDb();
    const fam = await createFamily(db);
    await completeQuest(db, fam.userId, fam.childId, "toy-store", { choice: "B", requestId: randomUUID() });
    await updateChildSettings(db, fam.userId, fam.childId, { allowanceEnabled: true, allowanceAmount: 20, allowanceInterval: 7, allowanceWeekday: 6, allowChildGoals: true }, WED);
    const progress = await getChildProgress(db, fam.userId, fam.childId, new Date("2026-10-24T03:00:00Z"));
    expect(progress.quests).toMatchObject({ done: 1, total: 5 });
    expect(progress.quests.topics.filter((t) => t.done).map((t) => t.category)).toEqual(["spend"]);
    expect(progress.quests.recent[0]).toMatchObject({ title: "夢想玩具店", label: "B. 先不買，100 全部存起來" });
    expect(progress.balance).toBe(INITIAL_GRANT + 10 + 20);
    expect(progress.prompts).toHaveLength(3);
    expect(progress.prompts[0]).toBe("如果玩具車下個月會打折，你的決定會改變嗎？");
  });

  it("討論題目：同一天固定，換一天會輪替；沒有紀錄時也有題目", () => {
    const d1 = new Date("2026-10-21T02:00:00Z");
    expect(discussionPrompts([], d1)).toEqual(discussionPrompts([], d1));
    expect(discussionPrompts([], d1)).not.toEqual(discussionPrompts([], new Date(d1.getTime() + DAY)));
    expect(new Set(discussionPrompts([], d1)).size).toBe(3);
  });
});
