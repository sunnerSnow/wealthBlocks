import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginLocalAction } from "@/app/actions";
import { ParentTop } from "@/components/parent-top";
import { LOCAL_USERS } from "@/lib/auth/local-users";
import { getSessionUser } from "@/lib/auth/session";
import { isLocalMode } from "@/lib/config";
import { SupabaseLoginForm } from "./supabase-login-form";

export const metadata: Metadata = { title: "登入" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSessionUser()) redirect("/");
  const { error } = await searchParams;
  const local = isLocalMode();

  return (
    <>
      <ParentTop />
      <main className="page page-narrow">
        <section className="card tagline-card p-6 sm:p-8">
          <h1 className="tagline font-extrabold leading-snug">用建造世界的方式，學會管理金錢。</h1>
          <p className="mt-2 text-[15px] text-ink-2">請家長登入。孩子不需要自己的帳號，家長登入後可以把裝置交給孩子玩。</p>
          {error === "confirm" ? <p className="alert mt-5">確認連結無效或已過期，請重新登入或註冊。</p> : null}

          {local ? (
            <>
              <p className="notice mt-5">
                本機示範模式：資料存在這台電腦的 <span className="num">web/.data/pglite</span>，不是正式資料庫。選一位示範家長登入；兩個家庭的資料互相看不到。
              </p>
              <div className="mt-6 grid gap-3">
                {LOCAL_USERS.map((u) => (
                  <form key={u.key} action={loginLocalAction}>
                    <input type="hidden" name="user" value={u.key} />
                    <button className={`btn btn-block ${u.key === "a" ? "btn-primary" : ""}`} type="submit">
                      以{u.label}登入
                    </button>
                  </form>
                ))}
              </div>
            </>
          ) : (
            <SupabaseLoginForm />
          )}
        </section>
        <p className="mt-6 text-center text-[13px] text-ink-2">財富積木使用虛擬積木幣，沒有真實付款、轉帳或投資功能。</p>
      </main>
    </>
  );
}
