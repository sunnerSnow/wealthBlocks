"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

/** 只列出已經能用的功能；任務、商店、目標會在之後的階段加進來 */
const NAV: { href: "/play" | "/play/ledger" | "/play/me"; label: string; icon: IconName }[] = [
  { href: "/play", label: "島嶼", icon: "brick" },
  { href: "/play/ledger", label: "帳本", icon: "receipt" },
  { href: "/play/me", label: "我的", icon: "user" },
];

export function KidsNav({ variant }: { variant: "tab" | "side" }) {
  const pathname = usePathname();
  return NAV.map((item) => {
    const current = pathname === item.href ? "page" : undefined;
    return variant === "tab" ? (
      <Link key={item.href} href={item.href} className="tab" aria-current={current}>
        <span className="ti">
          <Icon name={item.icon} />
        </span>
        {item.label}
      </Link>
    ) : (
      <Link key={item.href} href={item.href} className="navlink" aria-current={current}>
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </Link>
    );
  });
}
