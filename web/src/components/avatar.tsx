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

export function Avatar({ avatarKey, className = "av" }: { avatarKey: AvatarKey; className?: string }) {
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
      </svg>
    </span>
  );
}
