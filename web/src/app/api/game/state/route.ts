import { ok, requireActiveChild, withSession } from "@/lib/api/http";
import { getGameState } from "@/lib/services/game";

/** GET /api/game/state：這台裝置正在玩的孩子的遊戲狀態 */
export const GET = withSession(async ({ user, db }) => ok(await getGameState(db, user.id, await requireActiveChild(user))));
