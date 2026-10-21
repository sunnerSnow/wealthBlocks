import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/local";
import { type SettingKey, childSettings, parentSettingsLog, profiles } from "@/lib/db/schema";
import { type Tx, withUser } from "@/lib/db/with-user";
import { issuesFromZod, validationFailed } from "@/lib/errors";
import { allowanceKey, duePeriods, firstPayday, nextPayday } from "@/lib/game/allowance";
import { postVirtualTransaction } from "@/lib/services/ledger";
import { type ChildScope, lockChildScope, requireChildScope } from "@/lib/services/scope";

export interface ChildSettingsDto {
  allowanceEnabled: boolean;
  allowanceAmount: number;
  allowanceInterval: 7 | 14;
  /** 0 = 星期日 … 6 = 星期六 */
  allowanceWeekday: number;
  allowChildGoals: boolean;
  /** 下一次發零用錢的時間（沒啟用是 null） */
  nextPayday: string | null;
}

export interface SettingsLogDto {
  setting: SettingKey;
  oldValue: unknown;
  newValue: unknown;
  actorName: string;
  createdAt: string;
}

const DEFAULTS = { allowanceEnabled: false, allowanceAmount: 20, allowanceInterval: 7 as const, allowanceWeekday: 6, allowChildGoals: true };

type SettingsRow = typeof childSettings.$inferSelect;

async function loadRow(tx: Tx, scope: ChildScope, lock = false): Promise<SettingsRow | null> {
  const query = tx
    .select()
    .from(childSettings)
    .where(and(eq(childSettings.childId, scope.childId), eq(childSettings.familyId, scope.familyId)));
  const [row] = lock ? await query.for("update") : await query;
  return row ?? null;
}

function toDto(row: SettingsRow | null, now: Date): ChildSettingsDto {
  if (!row) return { ...DEFAULTS, nextPayday: null };
  const anchor = row.allowanceAnchorAt ? new Date(row.allowanceAnchorAt) : null;
  return {
    allowanceEnabled: row.allowanceEnabled,
    allowanceAmount: row.allowanceAmount,
    allowanceInterval: row.allowanceInterval === 14 ? 14 : 7,
    allowanceWeekday: row.allowanceWeekday,
    allowChildGoals: row.allowChildGoals,
    nextPayday: row.allowanceEnabled && anchor ? nextPayday(anchor, row.allowanceInterval, now).toISOString() : null,
  };
}

/** 在呼叫端的交易內讀設定（目標服務用來檢查孩子能不能自己建立目標） */
export async function readSettings(tx: Tx, scope: ChildScope, now = new Date()): Promise<ChildSettingsDto> {
  return toDto(await loadRow(tx, scope), now);
}

export async function getChildSettings(db: Db, userId: string, childId: string, now = new Date()): Promise<ChildSettingsDto> {
  return withUser(db, userId, async (tx) => readSettings(tx, await requireChildScope(tx, userId, childId), now));
}

const updateSchema = z.object({
  allowanceEnabled: z.boolean(),
  allowanceAmount: z.int("金額要是整數").min(5, "每次至少 5 積木幣").max(200, "每次最多 200 積木幣"),
  allowanceInterval: z.union([z.literal(7), z.literal(14)], { error: "請選擇每週或每兩週" }),
  allowanceWeekday: z.int().min(0, "請選擇星期幾").max(6, "請選擇星期幾"),
  allowChildGoals: z.boolean(),
});

/**
 * 家長修改孩子的設定（呼叫端要先確認是家長模式）。
 * 啟用零用錢、改發放日或間隔時重新起算（不會補發停用期間）；只改金額則之後每期照新金額發。
 * 每個有變動的欄位都寫一筆變更紀錄。
 */
export async function updateChildSettings(db: Db, userId: string, childId: string, input: unknown, now = new Date()): Promise<ChildSettingsDto> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) throw validationFailed(issuesFromZod(parsed.error));
  const next = parsed.data;
  return withUser(db, userId, async (tx) => {
    const scope = await lockChildScope(tx, userId, childId);
    const row = await loadRow(tx, scope, true);
    const before = toDto(row, now);

    const reschedule =
      next.allowanceEnabled &&
      (!before.allowanceEnabled || before.allowanceInterval !== next.allowanceInterval || before.allowanceWeekday !== next.allowanceWeekday || !row?.allowanceAnchorAt);
    const schedule = reschedule
      ? { allowanceAnchorAt: firstPayday(now, next.allowanceWeekday).toISOString(), allowanceLastPeriod: -1 }
      : next.allowanceEnabled
        ? {}
        : { allowanceAnchorAt: null, allowanceLastPeriod: -1 };
    const values = { ...next, ...schedule, updatedBy: userId };

    if (row) {
      await tx.update(childSettings).set(values).where(eq(childSettings.childId, scope.childId));
    } else {
      await tx.insert(childSettings).values({ childId: scope.childId, familyId: scope.familyId, ...values });
    }

    const changes: [SettingKey, unknown, unknown][] = [
      ["allowance_enabled", before.allowanceEnabled, next.allowanceEnabled],
      ["allowance_amount", before.allowanceAmount, next.allowanceAmount],
      ["allowance_interval", before.allowanceInterval, next.allowanceInterval],
      ["allowance_weekday", before.allowanceWeekday, next.allowanceWeekday],
      ["allow_child_goals", before.allowChildGoals, next.allowChildGoals],
    ];
    const changed = changes.filter(([, a, b]) => a !== b);
    if (changed.length) {
      await tx.insert(parentSettingsLog).values(
        changed.map(([setting, oldValue, newValue]) => ({ familyId: scope.familyId, childId: scope.childId, actorUserId: userId, setting, oldValue, newValue })),
      );
    }
    return toDto(await loadRow(tx, scope), now);
  });
}

export async function listSettingsLog(db: Db, userId: string, childId: string, limit = 10): Promise<SettingsLogDto[]> {
  return withUser(db, userId, async (tx) => {
    const scope = await requireChildScope(tx, userId, childId);
    const rows = await tx
      .select({
        setting: parentSettingsLog.setting,
        oldValue: parentSettingsLog.oldValue,
        newValue: parentSettingsLog.newValue,
        actorName: profiles.displayName,
        createdAt: parentSettingsLog.createdAt,
      })
      .from(parentSettingsLog)
      .innerJoin(profiles, eq(profiles.id, parentSettingsLog.actorUserId))
      .where(and(eq(parentSettingsLog.childId, scope.childId), eq(parentSettingsLog.familyId, scope.familyId)))
      .orderBy(desc(parentSettingsLog.createdAt), desc(parentSettingsLog.id))
      .limit(limit);
    return rows;
  });
}

/**
 * 發放到期的零用錢：孩子打開遊戲（或家長看進度）時呼叫。
 * 每一期的帳本編號固定，同一期不管呼叫幾次、同時呼叫幾次都只會入帳一次；很久沒打開最多補發幾期。
 * 回傳這次發了幾期。
 */
export async function settleAllowance(db: Db, userId: string, childId: string, now = new Date()): Promise<number> {
  return withUser(db, userId, async (tx) => {
    const scope = await lockChildScope(tx, userId, childId);
    const row = await loadRow(tx, scope, true);
    if (!row?.allowanceEnabled || !row.allowanceAnchorAt) return 0;
    const anchor = new Date(row.allowanceAnchorAt);
    const periods = duePeriods(anchor, row.allowanceInterval, now, row.allowanceLastPeriod);
    if (!periods.length) return 0;
    for (const period of periods) {
      await postVirtualTransaction(tx, {
        familyId: scope.familyId,
        walletId: scope.walletId,
        type: "allowance",
        amount: row.allowanceAmount,
        idempotencyKey: allowanceKey(anchor, period),
        description: row.allowanceInterval === 14 ? "零用錢（每兩週）" : "每週零用錢",
        referenceType: "allowance_rule",
      });
    }
    await tx
      .update(childSettings)
      .set({ allowanceLastPeriod: periods[periods.length - 1] })
      .where(eq(childSettings.childId, scope.childId));
    return periods.length;
  });
}
