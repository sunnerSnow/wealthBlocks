import type { Metadata } from "next";
import { requireKid } from "@/lib/auth/guards";
import { listShop } from "@/lib/services/shop";
import { ShopView } from "./shop-view";

export const metadata: Metadata = { title: "積木商店" };

export default async function ShopPage() {
  const { db, user, state } = await requireKid();
  const shop = await listShop(db, user.id, state.child.id);
  return (
    <section>
      <div className="view-head">
        <h1>積木商店</h1>
        <p>用積木幣換裝飾和建築。買之前想一想：是需要，還是想要？</p>
      </div>
      <ShopView initial={shop} />
    </section>
  );
}
