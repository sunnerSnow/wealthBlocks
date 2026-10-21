import { ok, requireActiveChild, withSession } from "@/lib/api/http";
import { getChildLedger } from "@/lib/services/game";

/** GET /api/wallet：目前餘額 */
export const GET = withSession(async ({ user, db }) => {
  const { balance } = await getChildLedger(db, user.id, await requireActiveChild(user));
  return ok({ currencyCode: "BLOCK_COIN", balance });
});
