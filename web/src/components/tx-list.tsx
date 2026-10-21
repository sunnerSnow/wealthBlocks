import { Icon, type IconName } from "@/components/icons";
import type { TxType } from "@/lib/db/schema";
import type { TxDto } from "@/lib/services/ledger";

const META: Record<TxType, { label: string; icon: IconName; tone: "in" | "out" | "save" }> = {
  initial_grant: { label: "初始積木幣", icon: "sparkle", tone: "in" },
  allowance: { label: "零用錢", icon: "calendar", tone: "in" },
  quest_reward: { label: "任務獎勵", icon: "star", tone: "in" },
  purchase: { label: "購買", icon: "bag", tone: "out" },
  goal_contribution: { label: "存入目標", icon: "arrowIn", tone: "save" },
  goal_withdrawal: { label: "從目標取回", icon: "arrowOut", tone: "save" },
  admin_adjustment: { label: "調整", icon: "receipt", tone: "out" },
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  });
}

/** 帳本列表：花費用深藍色而不是紅色，花錢不是做錯事 */
export function TxList({ items, showBalance = false }: { items: TxDto[]; showBalance?: boolean }) {
  return (
    <ul className="tx-list">
      {items.map((t) => {
        const m = META[t.type];
        return (
          <li key={t.id}>
            <span className={`tx-ic ${m.tone}`}>
              <Icon name={m.icon} />
            </span>
            <span className="t">
              <b>{t.description}</b>
              <small>
                {m.label} · <time dateTime={t.createdAt}>{when(t.createdAt)}</time>
              </small>
            </span>
            <span className="r">
              <span className={`amt ${t.amount > 0 ? "plus" : ""}`}>
                {t.amount > 0 ? "+" : "−"}
                {Math.abs(t.amount)}
              </span>
              {showBalance ? <small>餘額 {t.balanceAfter}</small> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
