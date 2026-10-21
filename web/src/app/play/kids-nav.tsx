"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

type Href = "/play" | "/play/quests" | "/play/shop" | "/play/goals" | "/play/me" | "/play/ledger";

const NAV: { href: Href; label: string; icon: IconName }[] = [
  { href: "/play", label: "島嶼", icon: "brick" },
  { href: "/play/quests", label: "任務", icon: "flag" },
  { href: "/play/shop", label: "商店", icon: "store" },
  { href: "/play/goals", label: "目標", icon: "piggy" },
  { href: "/play/me", label: "我的", icon: "user" },
];
/** 側欄多一個帳本（手機從頂端的積木幣進入） */
const SIDE_EXTRA: typeof NAV = [{ href: "/play/ledger", label: "帳本", icon: "receipt" }];

export function KidsNav({ variant, openQuests = 0 }: { variant: "tab" | "side"; openQuests?: number }) {
  const pathname = usePathname();
  const items = variant === "side" ? [...NAV, ...SIDE_EXTRA] : NAV;
  return items.map((item) => {
    const current = (item.href === "/play" ? pathname === item.href : pathname.startsWith(item.href)) ? "page" : undefined;
    const dot =
      item.href === "/play/quests" && openQuests > 0 ? (
        <span className="nav-dot" aria-label={`${openQuests} 個可以挑戰`}>
          {openQuests}
        </span>
      ) : null;
    return variant === "tab" ? (
      <Link key={item.href} href={item.href} className="tab" aria-current={current}>
        <span className="ti">
          <Icon name={item.icon} />
        </span>
        {item.label}
        {dot}
      </Link>
    ) : (
      <Link key={item.href} href={item.href} className="navlink" aria-current={current}>
        <Icon name={item.icon} />
        <span>{item.label}</span>
        {dot}
      </Link>
    );
  });
}
