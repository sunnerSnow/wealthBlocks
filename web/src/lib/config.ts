/**
 * 執行模式：
 * - Supabase 模式：NEXT_PUBLIC_SUPABASE_URL ＋ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY（或舊版 ANON_KEY）＋ DATABASE_URL 都有設
 * - 本機示範模式：三者都沒設；資料存在本機 PGlite，登入改成選示範家長
 * 只設一半視為設定錯誤，避免「以為連到正式資料庫，其實寫進本機」。
 */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function isLocalMode(): boolean {
  const hasSupabase = supabaseEnv() !== null;
  const hasDb = Boolean(process.env.DATABASE_URL);
  if (hasSupabase && hasDb) return false;
  if (hasSupabase !== hasDb) {
    throw new Error("設定不完整：Supabase 金鑰與 DATABASE_URL 必須一起設定（或都不設，使用本機示範模式）");
  }
  if (process.env.NODE_ENV === "production" && process.env.WB_LOCAL_MODE !== "1") {
    throw new Error("正式環境必須設定 Supabase 與 DATABASE_URL；本機用 next start 示範時請設 WB_LOCAL_MODE=1");
  }
  return true;
}

const LOCAL_SECRET = "wealth-blocks-local-demo-secret-do-not-use-in-production";

/** 簽章模式 cookie 的密鑰：Supabase 模式必須自己設定；本機示範模式沒設就用固定值 */
export function appSecret(): string {
  const secret = process.env.APP_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (secret) throw new Error("APP_SECRET 至少要 32 個字元");
  if (isLocalMode()) return LOCAL_SECRET;
  throw new Error("缺少 APP_SECRET（至少 32 個字元），用來簽章家長模式與孩子模式的 cookie");
}
