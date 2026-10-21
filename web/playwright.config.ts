import { defineConfig } from "@playwright/test";

/**
 * 端對端測試：建置後用 next start 啟動「本機示範模式」，資料庫是記憶體內的 PGlite（每次執行都是全新的）。
 * Supabase 相關變數一律清空，就算 .env.local 有正式金鑰也不會連到正式資料庫。
 * 瀏覽器用電腦上已安裝的 Chrome（channel: "chrome"），不需要另外下載。
 */
const PORT = 3330;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      WB_LOCAL_MODE: "1",
      PGLITE_DATA_DIR: "memory://",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      DATABASE_URL: "",
      APP_SECRET: "",
    },
  },
});
