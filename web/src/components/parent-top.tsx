import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { LocalBanner } from "@/components/local-banner";

/** 家長區與登入頁的頂端；登出只在家長模式出現 */
export function ParentTop({ mode, showLogout = false }: { mode?: "parent" | "kids"; showLogout?: boolean }) {
  return (
    <>
      <LocalBanner />
      <header className="parent-top">
        <Link href="/" aria-label="財富積木首頁" className="rounded-lg">
          <Brand />
        </Link>
        <div className="flex items-center gap-2">
          {mode === "parent" ? <span className="mode-badge parent">家長模式</span> : null}
          {mode === "kids" ? <span className="mode-badge kids">Kids 財富遊樂場</span> : null}
          {showLogout ? (
            <form action={logoutAction}>
              <button className="btn btn-ghost btn-sm" type="submit">
                <Icon name="logout" />
                登出
              </button>
            </form>
          ) : null}
        </div>
      </header>
    </>
  );
}
