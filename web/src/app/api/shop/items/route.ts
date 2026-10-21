import { ok, requireActiveChild, withSession } from "@/lib/api/http";
import { listShop } from "@/lib/services/shop";

/** GET /api/shop/items：商品、價格與能不能買 */
export const GET = withSession(async ({ user, db }) => ok(await listShop(db, user.id, await requireActiveChild(user))));
