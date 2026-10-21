import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
// 中文圓體自架（unicode-range 分片，用到才下載），見 scripts/subset-font.py
import "./fonts/chiron/chiron.css";
import "./globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "財富積木", template: "%s · 財富積木" },
  description: "用建造世界的方式，學會管理金錢。",
};

export const viewport: Viewport = {
  themeColor: "#F7F2E8",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className={fredoka.variable}>
      <body>{children}</body>
    </html>
  );
}
