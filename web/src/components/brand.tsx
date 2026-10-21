import { C } from "@/components/art/assets";

export function LogoMark({ className = "logo-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <rect x="4.5" y="17" width="4" height="4" rx="1" fill={C.teal} />
      <rect x="10.5" y="17" width="4" height="4" rx="1" fill={C.teal} />
      <rect x="21.5" y="17" width="4" height="4" rx="1" fill={C.coral} />
      <rect x="27.5" y="17" width="4" height="4" rx="1" fill={C.coral} />
      <rect x="2" y="20" width="15" height="13" rx="3" fill={C.teal} />
      <rect x="19" y="20" width="15" height="13" rx="3" fill={C.coral} />
      <rect x="12.5" y="3.5" width="4" height="4" rx="1" fill={C.yelD} />
      <rect x="19.5" y="3.5" width="4" height="4" rx="1" fill={C.yelD} />
      <rect x="10" y="6.5" width="16" height="13" rx="3" fill={C.yel} />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <LogoMark />
      <span className="brand-text">
        <b>財富積木</b>
        <small>WEALTH BLOCKS</small>
      </span>
    </span>
  );
}

export function Coin({ className = "coin" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.6" fill={C.yel} stroke={C.yelD} strokeWidth="1.8" />
      <rect x="5.3" y="9" width="9.4" height="5" rx="1.1" fill={C.navy} />
      <rect x="6.4" y="6.9" width="2.6" height="2.5" rx=".6" fill={C.navy} />
      <rect x="11" y="6.9" width="2.6" height="2.5" rx=".6" fill={C.navy} />
    </svg>
  );
}
