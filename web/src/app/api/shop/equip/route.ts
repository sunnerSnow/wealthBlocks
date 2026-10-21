import { ok, readJson, requireActiveChild, withSession } from "@/lib/api/http";
import { equipWear } from "@/lib/services/shop";

/** POST /api/shop/equip：{ slug } 戴上造型，{ slug: null } 摘下 */
export const POST = withSession(async ({ request, user, db }) => ok(await equipWear(db, user.id, await requireActiveChild(user), await readJson(request))));
