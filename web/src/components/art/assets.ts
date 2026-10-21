/**
 * 積木素材（與設計原型 design/kids-prototype.html 相同）。
 * 每個素材回傳 [viewBox 寬, viewBox 高, SVG 內容]；1 格 = 40 單位，底部對齊佔地格。
 * 內容全部是程式內建的固定字串，不含任何使用者輸入。
 */
export const C = {
  navy: "#20334F",
  navyD: "#16243A",
  yel: "#FFD34E",
  yelD: "#E2B22F",
  teal: "#56B7A5",
  tealD: "#3F9886",
  tealL: "#86CFC0",
  coral: "#C95D43",
  coralD: "#A8452E",
  coralL: "#EC9A7F",
  creamD: "#E4D9C4",
  white: "#FFFFFF",
  wood: "#B9835A",
  woodD: "#93623E",
  sh: "rgba(32,51,79,.18)",
} as const;

const stud = (x: number, y: number, fill: string, w = 8) => `<rect x="${x}" y="${y}" width="${w}" height="5" rx="2" fill="${fill}"/>`;

export type Art = readonly [vw: number, vh: number, body: string];

export const ASSETS: Record<string, () => Art> = {
  tent: () => [40, 56, `
    <ellipse cx="20" cy="51.5" rx="16" ry="3.5" fill="${C.sh}"/>
    <path d="M3 50 L20 12 L37 50 Z" fill="${C.yel}"/>
    <path d="M20 12 L37 50 L20 50 Z" fill="${C.yelD}"/>
    <path d="M13 50 L20 30 L27 50 Z" fill="${C.navy}"/>
    <rect x="19" y="3" width="2" height="11" fill="${C.navy}"/>
    <path d="M21 3.5 L30 6.8 L21 10 Z" fill="${C.coral}"/>`],
  rock: () => [40, 40, `
    <ellipse cx="20" cy="35" rx="15" ry="3" fill="${C.sh}"/>
    <path d="M6 34 L9 22 L18 14 L28 16 L35 25 L34 34 Z" fill="#B3BCC7"/>
    <path d="M18 14 L28 16 L35 25 L34 34 L22 34 L24 23 Z" fill="#8E99A7"/>
    <path d="M7 34l2-6 1.5 6 2-5 1.5 5" fill="${C.teal}"/>`],
  tree: () => [40, 68, `
    <ellipse cx="20" cy="63.5" rx="13" ry="3.5" fill="${C.sh}"/>
    <rect x="17" y="44" width="6" height="20" rx="2" fill="${C.wood}"/>
    <rect x="20" y="44" width="3" height="20" fill="${C.woodD}"/>
    <rect x="5" y="30" width="30" height="18" rx="5" fill="${C.teal}"/>
    <rect x="5" y="42" width="30" height="6" rx="3" fill="${C.tealD}"/>
    <rect x="9" y="17" width="22" height="16" rx="5" fill="${C.teal}"/>
    <rect x="9" y="28" width="22" height="5" rx="2.5" fill="${C.tealD}"/>
    <rect x="13" y="6" width="14" height="14" rx="5" fill="${C.tealL}"/>
    <rect x="13" y="16" width="14" height="4" rx="2" fill="${C.teal}"/>
    ${stud(16, 2, C.tealL)}`],
  flower: () => [40, 46, `
    <ellipse cx="20" cy="42" rx="16" ry="3" fill="${C.sh}"/>
    <path d="M12 30V18M20 30V13M28 30V19" stroke="${C.tealD}" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="16" cy="24" rx="3.6" ry="2" fill="${C.teal}" transform="rotate(-30 16 24)"/>
    <ellipse cx="24.5" cy="22.5" rx="3.6" ry="2" fill="${C.teal}" transform="rotate(30 24.5 22.5)"/>
    <circle cx="12" cy="16" r="5" fill="${C.coralL}"/><circle cx="12" cy="16" r="2" fill="${C.yel}"/>
    <circle cx="20" cy="11" r="5.5" fill="${C.white}"/><circle cx="20" cy="11" r="2.2" fill="${C.yel}"/>
    <circle cx="28" cy="17" r="5" fill="${C.yel}"/><circle cx="28" cy="17" r="2" fill="${C.coral}"/>
    <rect x="4" y="28" width="32" height="12" rx="3" fill="${C.coral}"/>
    <rect x="7" y="28.5" width="26" height="3" rx="1.5" fill="${C.woodD}"/>
    <rect x="4" y="35" width="32" height="5" rx="2.5" fill="${C.coralD}"/>`],
  lamp: () => [40, 78, `
    <ellipse cx="20" cy="73" rx="10" ry="3" fill="${C.sh}"/>
    <circle cx="20" cy="17" r="15" fill="${C.yel}" opacity=".25"/>
    <rect x="13" y="64" width="14" height="9" rx="2.5" fill="${C.navy}"/>
    <rect x="18.5" y="22" width="3" height="44" fill="${C.navy}"/>
    <rect x="11" y="10" width="18" height="14" rx="4" fill="${C.navy}"/>
    <rect x="14" y="13" width="12" height="8" rx="2" fill="${C.yel}"/>
    ${stud(16, 6, C.navy)}`],
  road: () => [40, 40, `
    <rect x="1" y="1" width="38" height="38" rx="5" fill="#D9CAAA"/>
    <rect x="1" y="1" width="38" height="34" rx="5" fill="#EFE5D0"/>
    <circle cx="12" cy="12" r="1.6" fill="#DDD0B4"/><circle cx="27" cy="22" r="1.4" fill="#DDD0B4"/><circle cx="17" cy="27" r="1.1" fill="#DDD0B4"/>`],
  pond: () => [80, 80, `
    <rect x="3" y="6" width="74" height="70" rx="30" fill="#4FA3BA"/>
    <rect x="3" y="3" width="74" height="68" rx="30" fill="#7FCBDC"/>
    <rect x="11" y="10" width="58" height="52" rx="24" fill="#9FDBE7"/>
    <path d="M20 26q6-3.5 12 0M42 48q6-3.5 12 0" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".85"/>
    <ellipse cx="54" cy="27" rx="8" ry="5" fill="${C.teal}"/>
    <path d="M54 27 L62.5 25 L62.5 29.5 Z" fill="#9FDBE7"/>
    <circle cx="51" cy="25.5" r="2.4" fill="${C.coralL}"/>
    <path d="M13 60v-9M16.5 61v-12M20 60v-8" stroke="${C.tealD}" stroke-width="2" stroke-linecap="round"/>
    <rect x="15.3" y="45" width="2.4" height="6" rx="1.2" fill="${C.woodD}"/>`],
  house: () => [80, 118, `
    <ellipse cx="40" cy="112" rx="36" ry="5" fill="${C.sh}"/>
    <rect x="5" y="100" width="70" height="10" rx="3" fill="#C9BB9C"/>
    <rect x="5" y="100" width="70" height="6" rx="3" fill="#DCD0B6"/>
    <rect x="11" y="58" width="58" height="44" fill="#FFFFFF"/>
    <rect x="59" y="58" width="10" height="44" fill="#EDE6D7"/>
    <path d="M11 69h58M11 80h58M11 91h58M25 58v11M45 58v11M35 69v11M55 69v11M25 80v11M45 80v11M35 91v11M55 91v11" stroke="#E6DED0" stroke-width="1.2"/>
    <path d="M34 102V85a6 6 0 0 1 12 0v17Z" fill="${C.navy}"/>
    <circle cx="43" cy="94" r="1.4" fill="${C.yel}"/>
    <rect x="16" y="71" width="13" height="13" rx="2" fill="${C.yel}" stroke="${C.navy}" stroke-width="2.4"/>
    <path d="M22.5 71v13M16 77.5h13" stroke="${C.navy}" stroke-width="1.6"/>
    <rect x="51" y="71" width="13" height="13" rx="2" fill="${C.yel}" stroke="${C.navy}" stroke-width="2.4"/>
    <path d="M57.5 71v13M51 77.5h13" stroke="${C.navy}" stroke-width="1.6"/>
    <rect x="57" y="14" width="9" height="22" fill="${C.navy}"/>
    ${stud(57.5, 10, C.navy)}
    <rect x="4" y="47" width="72" height="13" rx="3" fill="${C.coral}"/>
    <rect x="4" y="55" width="72" height="5" rx="2.5" fill="${C.coralD}"/>
    ${stud(5, 43, C.coral)}${stud(67, 43, C.coral)}
    <rect x="14" y="35" width="52" height="13" rx="3" fill="${C.coral}"/>
    <rect x="14" y="43" width="52" height="5" rx="2.5" fill="${C.coralD}"/>
    ${stud(15, 31, C.coral)}
    <rect x="24" y="23" width="32" height="13" rx="3" fill="${C.coral}"/>
    <rect x="24" y="31" width="32" height="5" rx="2.5" fill="${C.coralD}"/>
    ${stud(27, 19, C.coral)}${stud(36, 19, C.coral)}${stud(45, 19, C.coral)}`],
  shop: () => [80, 108, `
    <ellipse cx="40" cy="102" rx="36" ry="5" fill="${C.sh}"/>
    <rect x="5" y="90" width="70" height="10" rx="3" fill="#C9BB9C"/>
    <rect x="5" y="90" width="70" height="6" rx="3" fill="#DCD0B6"/>
    <rect x="9" y="46" width="62" height="46" fill="${C.teal}"/>
    <rect x="61" y="46" width="10" height="46" fill="${C.tealD}"/>
    <path d="M9 57h52M9 68h52M9 79h52" stroke="#fff" stroke-opacity=".2" stroke-width="1.2"/>
    <rect x="15" y="62" width="25" height="20" rx="2" fill="#E8F6F2" stroke="#fff" stroke-width="2.5"/>
    <path d="M15 75h25" stroke="${C.tealD}" stroke-width="1.5"/>
    <circle cx="21" cy="71" r="3" fill="${C.yel}"/><circle cx="28" cy="71" r="3" fill="${C.coralL}"/><rect x="32" y="67.5" width="5" height="7" rx="1" fill="${C.navy}"/>
    <rect x="46" y="62" width="16" height="30" rx="2" fill="${C.navy}"/>
    <rect x="49" y="66" width="10" height="9" rx="1.5" fill="#E8F6F2"/>
    <circle cx="59" cy="80" r="1.3" fill="${C.yel}"/>
    <rect x="5" y="38" width="70" height="12" fill="#fff"/>
    ${[5, 19, 33, 47, 61].map((x) => `<rect x="${x}" y="38" width="7" height="12" fill="${C.yel}"/>`).join("")}
    ${Array.from({ length: 10 }, (_, i) => `<circle cx="${8.5 + i * 7}" cy="50" r="3.5" fill="${i % 2 ? "#fff" : C.yel}"/>`).join("")}
    <rect x="4" y="36" width="72" height="4" rx="2" fill="${C.yelD}"/>
    <rect x="38" y="33" width="4" height="4" fill="${C.navy}"/>
    ${stud(22, 12, C.navy)}${stud(36, 12, C.navy)}${stud(50, 12, C.navy)}
    <rect x="18" y="16" width="44" height="18" rx="4" fill="${C.navy}"/>
    <circle cx="28" cy="25" r="5" fill="${C.yel}"/><rect x="25.5" y="24" width="5" height="3" rx=".6" fill="${C.navy}"/>
    <text x="36" y="29.5" font-size="11" font-weight="800" fill="#fff" font-family="Chiron GoRound TC, Noto Sans TC, sans-serif">商店</text>`],
  library: () => [80, 118, `
    <ellipse cx="40" cy="112" rx="36" ry="5" fill="${C.sh}"/>
    <rect x="5" y="101" width="70" height="9" rx="3" fill="#C9BB9C"/>
    <rect x="5" y="101" width="70" height="5" rx="2.5" fill="#DCD0B6"/>
    <rect x="10" y="94" width="60" height="8" rx="2" fill="#EFE7D8"/>
    <rect x="13" y="56" width="54" height="39" fill="#D5DEE9"/>
    <path d="M34 95V78a6 6 0 0 1 12 0v17Z" fill="${C.navy}"/>
    ${[14, 23, 50, 59].map((x) => `<rect x="${x}" y="56" width="7" height="39" fill="#fff"/><rect x="${x + 4.5}" y="56" width="2.5" height="39" fill="#E3E8EF"/>`).join("")}
    <rect x="8" y="46" width="64" height="11" rx="2" fill="${C.navy}"/>
    <path d="M6 47 L40 20 L74 47 Z" fill="${C.navy}"/>
    <path d="M17 44 L40 26 L63 44 Z" fill="${C.yel}"/>
    <path d="M33 41v-6.5q3.5-2 7 0q3.5-2 7 0V41q-3.5-2-7 0q-3.5-2-7 0Z" fill="#fff"/>
    <path d="M40 34.5V41" stroke="${C.navy}" stroke-width="1.2"/>
    ${stud(36, 15, C.navy)}`],
  /* 任務故事插圖用（不能放到島上） */
  car: () => [48, 32, `
    <ellipse cx="24" cy="29.5" rx="20" ry="2.5" fill="${C.sh}"/>
    <path d="M13 13l4-7h14l5 7Z" fill="${C.yel}"/>
    <path d="M19 12l2.5-4h4V12Z M28 12V8h2.5l2.5 4Z" fill="#E8F6F2"/>
    <rect x="4" y="13" width="40" height="11" rx="4" fill="${C.coral}"/>
    <rect x="4" y="20" width="40" height="4" rx="2" fill="${C.coralD}"/>
    <circle cx="13" cy="25" r="4.5" fill="${C.navy}"/><circle cx="13" cy="25" r="1.6" fill="${C.creamD}"/>
    <circle cx="35" cy="25" r="4.5" fill="${C.navy}"/><circle cx="35" cy="25" r="1.6" fill="${C.creamD}"/>`],
  cloud: () => [48, 40, `
    <path d="M12 26a7 7 0 0 1 1-13.9A9 9 0 0 1 30 9a7.5 7.5 0 0 1 6 15Z" fill="#8C9AB0"/>
    <path d="M14 30l-2 6M22 30l-2 6M30 30l-2 6" stroke="#5FA9C9" stroke-width="2.4" stroke-linecap="round"/>`],
  "hat-explorer": () => [40, 32, `
    <ellipse cx="20" cy="26" rx="18" ry="5" fill="${C.woodD}"/>
    <ellipse cx="20" cy="24.5" rx="18" ry="4.5" fill="${C.wood}"/>
    <path d="M8 24C8 8 32 8 32 24Z" fill="#D9A877"/>
    <rect x="8.4" y="18.5" width="23.2" height="4" fill="${C.navy}"/>`],
  "hat-cap": () => [40, 32, `
    <path d="M26 22 L38 23.5 Q38 27.5 30 27Z" fill="${C.navyD}"/>
    <path d="M6 24C6 8 30 8 30 24Z" fill="${C.navy}"/>
    <rect x="6" y="22" width="24" height="3.5" rx="1.5" fill="${C.navyD}"/>
    <path d="M18 11.5l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4Z" fill="${C.yel}"/>
    <circle cx="18" cy="9" r="1.6" fill="${C.navyD}"/>`],
};

export function getArt(assetKey: string): Art {
  const art = ASSETS[assetKey];
  if (!art) throw new Error(`沒有這個素材：${assetKey}`);
  return art();
}
