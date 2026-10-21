import { ok, readJson, requireActiveChild, withSession } from "@/lib/api/http";
import { moveObject, storeObject } from "@/lib/services/island";

type Ctx = RouteContext<"/api/island/objects/[id]">;

/** PATCH /api/island/objects/:id：移動，內容 { x, y } */
export const PATCH = withSession<Ctx>(async ({ request, ctx, user, db }) => {
  const { id } = await ctx.params;
  return ok(await moveObject(db, user.id, await requireActiveChild(user), id, await readJson(request)));
});

/** DELETE /api/island/objects/:id：收回收藏 */
export const DELETE = withSession<Ctx>(async ({ ctx, user, db }) => {
  const { id } = await ctx.params;
  return ok(await storeObject(db, user.id, await requireActiveChild(user), id));
});
