import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 頁面都是某個家庭的即時資料（積木幣、島嶼），沒有可共用的快取，
  // 所以不用 Cache Components（partialPrefetching 也需要它，一起不開）；讀 cookie 的頁面自然是動態頁。
  cacheComponents: false,
  // PGlite 會在執行時載入 WASM 與資料檔，postgres 是原生 TCP 驅動，都不要被打包
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // 兒童網站的基本安全標頭：不能被別的網站嵌入、不送完整來源網址、用不到的裝置權限一律關閉
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
