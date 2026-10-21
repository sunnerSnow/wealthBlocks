import { ok, withSession } from "@/lib/api/http";
import { readPlayMode } from "@/lib/auth/mode";
import { AppError } from "@/lib/errors";
import { getGameState } from "@/lib/services/game";

/** GET /api/game/state：這台裝置正在玩的孩子的遊戲狀態（孩子由簽章 cookie 決定，不從網址帶入） */
export const GET = withSession(async ({ user, db }) => {
  const { kidChildId } = await readPlayMode(user.id);
  if (!kidChildId) throw new AppError("no_active_child", "目前沒有正在玩的孩子", 409);
  return ok(await getGameState(db, user.id, kidChildId));
});
