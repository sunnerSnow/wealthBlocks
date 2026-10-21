import Link from "next/link";
import { redirect } from "next/navigation";
import { startPlayingAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { ParentTop } from "@/components/parent-top";
import { loadFamilyContext } from "@/lib/auth/guards";
import { listChildren } from "@/lib/services/children";

/**
 * 入口：依狀態導向 —— 還沒建立家庭 → /setup；正在玩 → /play；家長模式 → /family；
 * 其他情況（例如孩子按了「換人玩」）顯示「誰要來玩？」，進家長區要 PIN。
 */
export default async function Home() {
  const { user, db, family, mode } = await loadFamilyContext();
  if (!family) redirect("/setup");
  const kids = await listChildren(db, user.id);
  if (mode.kidChildId && kids.some((k) => k.id === mode.kidChildId)) redirect("/play");
  if (mode.parentUnlocked) redirect("/family");

  return (
    <>
      <ParentTop mode="kids" />
      <main className="page">
        <div className="view-head text-center">
          <h1>誰要來玩？</h1>
          <p>{family.name}的積木島</p>
        </div>
        <ul className="picker">
          {kids.map((k) => (
            <li key={k.id}>
              <form action={startPlayingAction}>
                <input type="hidden" name="childId" value={k.id} />
                <button className="pick-kid" type="submit">
                  <Avatar avatarKey={k.avatarKey} />
                  <b>{k.displayName}</b>
                  <small>
                    Lv.{k.level} {k.levelTitle}
                  </small>
                </button>
              </form>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <Link className="btn btn-ghost" href="/family/unlock">
            <Icon name="lock" />
            家長區
          </Link>
        </div>
      </main>
    </>
  );
}
