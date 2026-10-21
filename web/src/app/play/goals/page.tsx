import type { Metadata } from "next";
import { kidGoals } from "@/lib/auth/guards";
import { GoalsView } from "./goals-view";

export const metadata: Metadata = { title: "儲蓄目標" };

export default async function GoalsPage() {
  const goals = await kidGoals();
  return (
    <section>
      <div className="view-head">
        <h1>儲蓄目標</h1>
        <p>把積木幣放進目標，就不會不小心花掉。計畫改變時，隨時都可以取回。</p>
      </div>
      <GoalsView initial={goals} />
    </section>
  );
}
