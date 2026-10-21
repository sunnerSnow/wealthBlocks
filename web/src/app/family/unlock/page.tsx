import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ParentTop } from "@/components/parent-top";
import { loadFamilyContext } from "@/lib/auth/guards";
import { UnlockForm } from "./unlock-form";

export const metadata: Metadata = { title: "家長區" };

export default async function UnlockPage() {
  const { family, mode } = await loadFamilyContext();
  if (!family) redirect("/setup");
  if (mode.parentUnlocked) redirect("/family");
  return (
    <>
      <ParentTop mode="parent" />
      <main className="page page-narrow">
        <div className="view-head">
          <h1>家長區</h1>
          <p>請輸入家長 PIN。</p>
        </div>
        <UnlockForm />
        <p className="mt-6 text-center">
          <Link className="link" href="/">
            回到「誰要來玩？」
          </Link>
        </p>
      </main>
    </>
  );
}
