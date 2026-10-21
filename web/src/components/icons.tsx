/** 介面圖示（線條風格，24×24）；只用在有文字標籤的地方，或另外提供 aria-label */
const PATHS = {
  brick: "<rect x='3' y='10' width='18' height='10' rx='2'/><path d='M7 10V7.5h4V10M13 10V7.5h4V10'/>",
  flag: "<path d='M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z'/><path d='M4 22v-7'/>",
  store: "<path d='M3 9l1.6-5h14.8L21 9'/><path d='M3 9h18v1.4a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z'/><path d='M5 13v7h14v-7'/><path d='M10 20v-4h4v4'/>",
  piggy: "<path d='M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z'/><path d='M2 9v1c0 1.1.9 2 2 2h1'/><path d='M16 11h.01'/>",
  user: "<path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/>",
  receipt: "<path d='M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z'/><path d='M16 8h-8M16 12h-8M13 16h-5'/>",
  lock: "<rect width='18' height='11' x='3' y='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/>",
  check: "<path d='M20 6 9 17l-5-5'/>",
  plus: "<path d='M12 5v14M5 12h14'/>",
  play: "<path d='M7 4.5v15l12-7.5z'/>",
  swap: "<path d='M17 3l4 4-4 4'/><path d='M3 7h18'/><path d='M7 21l-4-4 4-4'/><path d='M21 17H3'/>",
  logout: "<path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'/><path d='m16 17 5-5-5-5'/><path d='M21 12H9'/>",
  sparkle: "<path d='M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'/>",
  calendar: "<rect width='18' height='18' x='3' y='4' rx='2'/><path d='M16 2v4M8 2v4M3 10h18'/>",
  star: "<path d='M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z' fill='currentColor'/>",
  bag: "<path d='M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'/><path d='M3 6h18'/><path d='M16 10a4 4 0 0 1-8 0'/>",
  arrowIn: "<path d='M12 3v12'/><path d='m7 10 5 5 5-5'/><path d='M5 21h14'/>",
  arrowOut: "<path d='M12 15V3'/><path d='m7 8 5-5 5 5'/><path d='M5 21h14'/>",
  info: "<circle cx='12' cy='12' r='10'/><path d='M12 16v-4M12 8h.01'/>",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "ic" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
