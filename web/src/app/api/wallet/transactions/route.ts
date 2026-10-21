import { ok, requireActiveChild, withSession } from "@/lib/api/http";
import { getChildLedger } from "@/lib/services/game";

/** GET /api/wallet/transactions：帳本（新到舊） */
export const GET = withSession(async ({ user, db }) => ok((await getChildLedger(db, user.id, await requireActiveChild(user))).transactions));
