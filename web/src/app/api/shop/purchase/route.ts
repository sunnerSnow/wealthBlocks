import { ok, readJson, requireActiveChild, withSession } from "@/lib/api/http";
import { purchase } from "@/lib/services/shop";

/** POST /api/shop/purchase：{ slug, requestId }；價格由伺服器決定，同一個 requestId 只扣一次 */
export const POST = withSession(async ({ request, user, db }) => ok(await purchase(db, user.id, await requireActiveChild(user), await readJson(request))));
