import { C } from "@/components/art/assets";
import type { AvatarKey } from "@/lib/game/input";

/** 積木人頭：頭像只換顏色，不用照片，也不需要真實長相 */
const HEADS: Record<AvatarKey, { head: string; stud: string; label: string }> = {
  sun: { head: C.yel, stud: C.yelD, label: "黃色" },
  mint: { head: C.tealL, stud: C.teal, label: "青綠色" },
  peach: { head: "#F2B49E", stud: C.coralL, label: "蜜桃色" },
  sand: { head: "#F3D9B1", stud: "#DDBB88", label: "沙色" },
};

export const AVATAR_LABEL = (key: AvatarKey) => HEADS[key].label;

/** 戴在積木人頭上的造型（商店的「造型」商品，依素材代號） */
const HATS: Record<string, string> = {
  "hat-explorer": `<ellipse cx="24" cy="15" rx="21" ry="4.5" fill="${C.wood}"/><path d="M11 15C11 1 37 1 37 15Z" fill="#D9A877"/><rect x="11.3" y="10.5" width="25.4" height="4" fill="${C.navy}"/>`,
  "hat-cap": `<path d="M34 13.5 L46 15.5 Q46 19.5 37 18.5Z" fill="${C.navyD}"/><path d="M9 16C9 1 37 1 37 16Z" fill="${C.navy}"/><rect x="9" y="13.5" width="28" height="3.5" rx="1.5" fill="${C.navyD}"/><path d="M23 4.5l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4Z" fill="${C.yel}"/>`,
};

export function Avatar({ avatarKey, hat, className = "av" }: { avatarKey: AvatarKey; hat?: string | null; className?: string }) {
  const h = HEADS[avatarKey] ?? HEADS.sun;
  return (
    <span className={className}>
      <svg viewBox="0 0 48 50" aria-hidden="true" focusable="false">
        <rect x="18" y="6" width="12" height="8" rx="2.5" fill={h.stud} />
        <rect x="8" y="11" width="32" height="31" rx="10" fill={h.head} />
        <circle cx="19" cy="25" r="2.6" fill={C.navy} />
        <circle cx="29" cy="25" r="2.6" fill={C.navy} />
        <path d="M18 31.5q6 5 12 0" stroke={C.navy} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="13.5" cy="31" r="2.6" fill={C.coralL} opacity=".55" />
        <circle cx="34.5" cy="31" r="2.6" fill={C.coralL} opacity=".55" />
        <rect x="12" y="42" width="24" height="10" rx="4" fill={C.navy} />
        {hat && HATS[hat] ? <g dangerouslySetInnerHTML={{ __html: HATS[hat] }} /> : null}
      </svg>
    </span>
  );
}
