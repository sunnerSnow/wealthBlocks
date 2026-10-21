import { ok, readJson, requireActiveChild, withSession } from "@/lib/api/http";
import { withdrawFromGoal } from "@/lib/services/goals";

/** POST /api/goals/:id/withdraw：{ amount, requestId } 從目標取回 */
export const POST = withSession<RouteContext<"/api/goals/[id]/withdraw">>(async ({ request, ctx, user, db }) => {
  const { id } = await ctx.params;
  return ok(await withdrawFromGoal(db, user.id, await requireActiveChild(user), id, await readJson(request)));
});
