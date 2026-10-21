import { ok, readJson, requireActiveChild, withSession } from "@/lib/api/http";
import { createGoal, listGoals } from "@/lib/services/goals";

/** GET /api/goals：目標清單與可以設成目標的獎勵 */
export const GET = withSession(async ({ user, db }) => ok(await listGoals(db, user.id, await requireActiveChild(user))));

/** POST /api/goals：{ reward } 或 { title, target }（自訂目標） */
export const POST = withSession(async ({ request, user, db }) =>
  ok(await createGoal(db, user.id, await requireActiveChild(user), await readJson(request)), { status: 201 }),
);
