import type { Metadata } from "next";
import { Coin } from "@/components/brand";
import { TxList } from "@/components/tx-list";
import { requireKid } from "@/lib/auth/guards";
import { getChildLedger } from "@/lib/services/game";

export const metadata: Metadata = { title: "積木幣帳本" };

export default async function LedgerPage() {
  const { user, db, state } = await requireKid();
  const ledger = await getChildLedger(db, user.id, state.child.id);
  const income = ledger.transactions.filter((t) => t.amount > 0 && t.type !== "goal_withdrawal").reduce((n, t) => n + t.amount, 0);
  const spent = ledger.transactions.filter((t) => t.type === "purchase").reduce((n, t) => n - t.amount, 0);

  return (
    <section className="mx-auto max-w-[640px]">
      <div className="view-head">
        <h1>積木幣帳本</h1>
        <p>每一筆積木幣的變動都會記在這裡。帳本只能新增、不能修改。</p>
      </div>
      <div className="card bal-hero">
        <Coin />
        <div>
          <small>目前餘額</small>
          <b>{ledger.balance}</b>
        </div>
      </div>
      <div className="my-4 grid grid-cols-2 gap-2">
        <div className="stat bg-white">
          <small>收入</small>
          <b>{income}</b>
        </div>
        <div className="stat bg-white">
          <small>花費</small>
          <b>{spent}</b>
        </div>
      </div>
      <div className="card px-4 py-1">
        <TxList items={ledger.transactions} showBalance />
      </div>
    </section>
  );
}
