import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ParentTop } from "@/components/parent-top";
import { loadFamilyContext } from "@/lib/auth/guards";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "建立家庭" };

export default async function SetupPage() {
  const { family } = await loadFamilyContext();
  if (family) redirect("/");
  return (
    <>
      <ParentTop mode="parent" />
      <main className="page page-narrow">
        <div className="view-head">
          <h1>建立你的家庭</h1>
          <p>設定家長 PIN，再幫第一位孩子建立積木島。之後孩子玩的時候，要回到家長區得輸入 PIN。</p>
        </div>
        <SetupForm />
      </main>
    </>
  );
}
