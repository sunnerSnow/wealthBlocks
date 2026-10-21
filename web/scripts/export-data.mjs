/**
 * 把正式資料庫 wealth schema 的所有資料表匯出成一個 JSON 檔（Supabase 免費方案沒有自動備份）。
 *
 * 用法（在 web/ 底下）：
 *   DATABASE_URL="postgresql://…" node scripts/export-data.mjs
 *   PowerShell：$env:DATABASE_URL="postgresql://…"; node scripts/export-data.mjs
 *
 * - 輸出到 web/backups/wealth-<時間>.json（已在 .gitignore，不要上傳到 GitHub 或公開的地方：裡面有孩子的暱稱）
 * - 只讀不寫；用 Supabase 的連線字串（Session pooler 5432 或 Transaction pooler 6543 都可以）
 * - 共用主檔（任務、商品、建築）也一起匯出，方便對照；它們本來就由 migration 維護
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("請先設定 DATABASE_URL");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
try {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'wealth' and table_type = 'BASE TABLE'
    order by table_name`;
  const data = {};
  for (const { table_name: name } of tables) {
    data[name] = await sql`select * from ${sql("wealth")}.${sql(name)}`;
    console.log(`${name}: ${data[name].length} 筆`);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "backups");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `wealth-${stamp}.json`);
  await writeFile(file, JSON.stringify({ exportedAt: new Date().toISOString(), schema: "wealth", tables: data }, null, 2));
  console.log(`已匯出到 ${file}`);
} finally {
  await sql.end();
}
