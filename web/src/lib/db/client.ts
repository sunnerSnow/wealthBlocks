import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isLocalMode } from "@/lib/config";
import { type Db, openLocalDb } from "@/lib/db/local";
import { schema } from "@/lib/db/schema";

export type { Db } from "@/lib/db/local";

const cache = globalThis as unknown as { __wealthDb?: Promise<Db> };

/**
 * 取得資料庫：
 * - 有 DATABASE_URL：連 Supabase Postgres（建議用 pooler 的 transaction mode，所以關掉 prepared statements）
 * - 沒有：本機示範模式，用 PGlite 存在 web/.data/pglite，啟動時自動跑 migration
 */
export function getDb(): Promise<Db> {
  cache.__wealthDb ??= createDb().catch((error) => {
    cache.__wealthDb = undefined;
    throw error;
  });
  return cache.__wealthDb;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { prepare: false, max: Number(process.env.DATABASE_POOL_MAX ?? 5) });
    return drizzlePostgres(client, { schema });
  }
  if (!isLocalMode()) throw new Error("缺少 DATABASE_URL");
  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (dataDir === "memory://") return openLocalDb(new PGlite());
  // PGlite 只會建立最後一層資料夾；第一次啟動時 .data 還不存在，要先把整條路徑建好
  await mkdir(dataDir, { recursive: true });
  return openLocalDb(new PGlite(dataDir));
}
