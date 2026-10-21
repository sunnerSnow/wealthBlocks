import { ok, requireActiveChild, withSession } from "@/lib/api/http";
import { getIsland } from "@/lib/services/island";

/** GET /api/island：島上的物件與還沒放的收藏 */
export const GET = withSession(async ({ user, db }) => ok(await getIsland(db, user.id, await requireActiveChild(user))));
