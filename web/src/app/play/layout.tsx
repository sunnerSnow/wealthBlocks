import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Brand, Coin } from "@/components/brand";
import { LocalBanner } from "@/components/local-banner";
import { TxList } from "@/components/tx-list";
import { requireKid } from "@/lib/auth/guards";
import { KidsNav } from "./kids-nav";

/** 孩子模式外框：頂端（積木幣、等級、頭像）＋導覽＋桌面右側欄；每個頁面仍會自己呼叫 requireKid */
export default async function PlayLayout({ children }: LayoutProps<"/play">) {
  const { state } = await requireKid();
  const { progress } = state;
  return (
    <>
      <LocalBanner />
      <div className="kid-app">
        <header className="topbar">
          <Link href="/play" aria-label="回到積木島" className="rounded-lg">
            <Brand />
          </Link>
          <span className="mode-badge kids">Kids 財富遊樂場</span>
          <span className="top-spacer" />
          <div className="top-level" aria-label={`等級 ${progress.level}，經驗 ${progress.current}/${progress.needed}`}>
            <span className="lv-badge">Lv.{progress.level}</span>
            <span>{progress.title}</span>
            <span className="xpbar" aria-hidden="true">
              <i style={{ width: `${progress.percent}%` }} />
            </span>
            <span className="num text-ink-2">
              {progress.current}/{progress.needed}
            </span>
          </div>
          <Link className="coinpill" href="/play/ledger" aria-label={`積木幣 ${state.balance}，查看帳本`}>
            <Coin />
            <span>{state.balance}</span>
          </Link>
          <Link className="avatar-link" href="/play/me" aria-label={`${state.child.displayName}的個人頁`}>
            <Avatar avatarKey={state.child.avatarKey} />
            <span className="name">{state.child.displayName}</span>
          </Link>
        </header>

        <nav className="sidenav" aria-label="主要功能">
          <KidsNav variant="side" />
        </nav>

        <main className="kid-main">{children}</main>

        <aside className="rail" aria-label="近期活動">
          <h2 className="sec-title">
            近期活動
            <Link className="link" href="/play/ledger">
              帳本
            </Link>
          </h2>
          <div className="card px-4 py-1">
            <TxList items={state.recentTransactions} />
          </div>
        </aside>

        <nav className="tabbar" aria-label="主要功能">
          <KidsNav variant="tab" />
        </nav>
      </div>
    </>
  );
}
