import { ok, readJson, requireActiveChild, withSession } from "@/lib/api/http";
import { placeObject } from "@/lib/services/island";

/** POST /api/island/objects：從收藏拿一件放到島上，內容 { slug, x, y }；回傳最新的島嶼狀態 */
export const POST = withSession(async ({ request, user, db }) =>
  ok(await placeObject(db, user.id, await requireActiveChild(user), await readJson(request)), { status: 201 }),
);
