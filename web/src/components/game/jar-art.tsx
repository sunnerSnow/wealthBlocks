import { C } from "@/components/art/assets";

export const JAR_COLOR = { spend: C.coral, save: C.teal, share: C.yel } as const;

/** 透明罐子，fill 是 0–1 的裝滿程度 */
export function JarArt({ fill, color, className }: { fill: number; color: string; className?: string }) {
  const h = Math.round(34 * Math.max(0, Math.min(1, fill)));
  return (
    <svg className={className} viewBox="0 0 44 52" aria-hidden="true" focusable="false">
      <rect x="12" y="2" width="20" height="7" rx="2" fill={C.yel} />
      <rect x="9" y="8" width="26" height="4" rx="2" fill={C.yelD} />
      <path d="M8 14Q8 11 11 11H33Q36 11 36 14V44Q36 50 30 50H14Q8 50 8 44Z" fill="#F1F8F9" stroke={C.navy} strokeWidth="2" />
      {h > 0 ? <rect x="10" y={48 - h} width="24" height={h} rx="4" fill={color} /> : null}
      <path d="M13 17v18" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}
