import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { readPlayMode } from "@/lib/auth/mode";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AppError } from "@/lib/errors";
import { getMyFamily } from "@/lib/services/family";
import { getGameState } from "@/lib/services/game";
import { listGoals } from "@/lib/services/goals";
import { listQuests } from "@/lib/services/quests";
import { settleAllowance } from "@/lib/services/settings";

/** 登入的家長、所屬家庭與這台裝置的模式（同一個請求內只查一次） */
export const loadFamilyContext = cache(async () => {
  const user = await requireUser();
  const db = await getDb();
  const family = await getMyFamily(db, user.id);
  const mode = await readPlayMode(user.id);
  return { user, db, family, mode };
});

/** 家長區：要有家庭，而且這台裝置在家長模式（登入或輸入 PIN 之後） */
export async function requireParentArea() {
  const ctx = await loadFamilyContext();
  if (!ctx.family) redirect("/setup");
  if (!ctx.mode.parentUnlocked) redirect("/family/unlock");
  return { ...ctx, family: ctx.family };
}

/** 孩子區：要有正在玩的孩子，而且孩子屬於這個家庭；否則回到「誰要來玩？」 */
export const requireKid = cache(async () => {
  const ctx = await loadFamilyContext();
  if (!ctx.family) redirect("/setup");
  const childId = ctx.mode.kidChildId;
  if (!childId) redirect("/");
  try {
    // 先發放到期的零用錢，畫面上的積木幣才會是最新的
    await settleAllowance(ctx.db, ctx.user.id, childId);
    const state = await getGameState(ctx.db, ctx.user.id, childId);
    return { ...ctx, family: ctx.family, state };
  } catch (error) {
    if (error instanceof AppError && error.status === 404) redirect("/");
    throw error;
  }
});

/** 孩子模式的任務清單與目標（外框的右側欄和頁面共用，同一個請求只查一次） */
export const kidQuests = cache(async () => {
  const { db, user, state } = await requireKid();
  return listQuests(db, user.id, state.child.id);
});

export const kidGoals = cache(async () => {
  const { db, user, state } = await requireKid();
  return listGoals(db, user.id, state.child.id);
});
