import { ok, requireActiveChild, withSession } from "@/lib/api/http";
import { listQuests } from "@/lib/services/quests";

/** GET /api/quests：任務清單與每個任務的狀態（可挑戰／已完成／還沒解鎖） */
export const GET = withSession(async ({ user, db }) => ok(await listQuests(db, user.id, await requireActiveChild(user))));
