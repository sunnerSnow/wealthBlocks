import type { Metadata } from "next";
import Link from "next/link";
import { startPlayingAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Coin } from "@/components/brand";
import { Icon } from "@/components/icons";
import { ParentTop } from "@/components/parent-top";
import { requireParentArea } from "@/lib/auth/guards";
import { MAX_CHILDREN } from "@/lib/game/economy";
import { AGE_BAND_LABEL } from "@/lib/game/input";
import { listChildren } from "@/lib/services/children";
import { AddChildForm } from "./add-child-form";

export const metadata: Metadata = { title: "家長區" };

export default async function FamilyPage() {
  const { user, db, family } = await requireParentArea();
  const kids = await listChildren(db, user.id);

  return (
    <>
      <ParentTop mode="parent" showLogout />
      <main className="page">
        <div className="view-head">
          <h1>{family.name}</h1>
          <p>{family.parentName}，可以看孩子的學習進度、設定零用錢，或選一位孩子開始玩。交給孩子之後，要回到這裡得輸入家長 PIN。</p>
        </div>

        <ul className="kid-list">
          {kids.map((k) => (
            <li key={k.id} className="card kid-row">
              <Avatar avatarKey={k.avatarKey} />
              <div className="meta">
                <b>{k.displayName}</b>
                <span>
                  {AGE_BAND_LABEL[k.ageBand]} · Lv.{k.level} {k.levelTitle}
                </span>
                <span className="mt-1 inline-flex items-center gap-1">
                  <Coin />
                  <span className="num">{k.balance}</span> 積木幣
                </span>
              </div>
              <div className="actions">
                <Link className="btn btn-sm" href={`/family/children/${k.id}`}>
                  學習進度
                </Link>
                <form action={startPlayingAction}>
                  <input type="hidden" name="childId" value={k.id} />
                  <button className="btn btn-primary btn-sm" type="submit">
                    <Icon name="play" />
                    開始玩
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>

        {kids.length < MAX_CHILDREN ? (
          <section className="mt-8">
            <AddChildForm />
          </section>
        ) : (
          <p className="notice mt-8">一個家庭最多 {MAX_CHILDREN} 位孩子。</p>
        )}
      </main>
    </>
  );
}
