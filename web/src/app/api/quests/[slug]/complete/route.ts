import { ok, readJson, requireActiveChild, withSession } from "@/lib/api/http";
import { completeQuest } from "@/lib/services/quests";

/** POST /api/quests/:slug/complete：送出答案 { choice } 或 { alloc }，加上 requestId；獎勵由伺服器決定 */
export const POST = withSession<RouteContext<"/api/quests/[slug]/complete">>(async ({ request, ctx, user, db }) => {
  const { slug } = await ctx.params;
  return ok(await completeQuest(db, user.id, await requireActiveChild(user), slug, await readJson(request)));
});
