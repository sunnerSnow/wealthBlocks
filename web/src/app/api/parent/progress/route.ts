import type { NextRequest } from "next/server";
import { ok, requireParentUnlocked, withSession } from "@/lib/api/http";
import { getChildProgress } from "@/lib/services/progress";

/** GET /api/parent/progress?childId=…：家長看孩子的學習進度（要在家長模式；孩子必須屬於這個家庭） */
export const GET = withSession(async ({ request, user, db }) => {
  await requireParentUnlocked(user);
  const childId = new URL((request as NextRequest).url).searchParams.get("childId") ?? "";
  return ok(await getChildProgress(db, user.id, childId));
});
