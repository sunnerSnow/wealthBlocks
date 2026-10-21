"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BlockArt } from "@/components/art/block-art";

/** 出錯時的畫面：不顯示技術細節，只給錯誤代碼方便對照伺服器日誌 */
export function ErrorScreen({ error, retry, home }: { error: unknown; retry: () => void; home: "/" | "/play" }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : null;
  return (
    <main className="page page-narrow">
      <section className="card grid justify-items-center gap-3 p-8 text-center">
        <div className="art-stage w-full">
          <BlockArt asset="rock" />
        </div>
        <h1 className="text-[22px] font-extrabold">哎呀，積木倒了</h1>
        <p className="text-[15px] text-ink-2">畫面出了一點問題。你的積木幣和島嶼都還在，可以再試一次。</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => retry()}>
            再試一次
          </button>
          <Link className="btn" href={home}>
            {home === "/play" ? "回到積木島" : "回到首頁"}
          </Link>
        </div>
        {digest ? <p className="text-[12px] text-ink-2">錯誤代碼：{digest}</p> : null}
      </section>
    </main>
  );
}
