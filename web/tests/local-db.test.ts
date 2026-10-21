import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";

const root = await mkdtemp(path.join(os.tmpdir(), "wealth-blocks-"));

afterAll(async () => {
  await rm(root, { recursive: true, force: true }).catch(() => undefined);
});

describe("本機示範模式的資料庫", () => {
  it("第一次啟動時，資料夾的上層還不存在也能建立（例如全新的 web/.data/pglite）", async () => {
    process.env.PGLITE_DATA_DIR = path.join(root, "not-yet", ".data", "pglite");
    const db = await getDb();
    const result = await db.execute(sql`select count(*)::int as n from wealth.quests`);
    const rows = (result as unknown as { rows?: { n: number }[] }).rows ?? (result as unknown as { n: number }[]);
    expect(Number(rows[0].n)).toBe(5);
  });
});
