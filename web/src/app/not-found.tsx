import Link from "next/link";
import { BlockArt } from "@/components/art/block-art";

export default function NotFound() {
  return (
    <main className="page page-narrow">
      <section className="card grid justify-items-center gap-3 p-8 text-center">
        <div className="art-stage w-full">
          <BlockArt asset="tent" />
        </div>
        <h1 className="text-[22px] font-extrabold">找不到這一頁</h1>
        <p className="text-[15px] text-ink-2">這裡什麼都沒有，回到首頁看看吧。</p>
        <Link className="btn btn-primary mt-2" href="/">
          回到首頁
        </Link>
      </section>
    </main>
  );
}
