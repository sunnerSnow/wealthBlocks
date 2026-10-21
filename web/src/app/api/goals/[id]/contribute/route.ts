import { ok, readJson, requireActiveChild, withSession } from "@/lib/api/http";
import { contributeToGoal } from "@/lib/services/goals";

/** POST /api/goals/:id/contribute：{ amount, requestId } 存入目標 */
export const POST = withSession<RouteContext<"/api/goals/[id]/contribute">>(async ({ request, ctx, user, db }) => {
  const { id } = await ctx.params;
  return ok(await contributeToGoal(db, user.id, await requireActiveChild(user), id, await readJson(request)));
});
