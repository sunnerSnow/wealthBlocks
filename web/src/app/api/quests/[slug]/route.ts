import { ok, requireActiveChild, withSession } from "@/lib/api/http";
import { getQuest } from "@/lib/services/quests";

/** GET /api/quests/:slug：任務內容（情境、選項） */
export const GET = withSession<RouteContext<"/api/quests/[slug]">>(async ({ ctx, user, db }) => {
  const { slug } = await ctx.params;
  return ok(await getQuest(db, user.id, await requireActiveChild(user), slug));
});
