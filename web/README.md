# Wealth Blocks 財富積木 web

兒童理財遊戲化平台的正式程式。設計原型在上一層的 `design/kids-prototype.html`。

目前完成：

- **Phase 1：專案基礎**：家長登入、建立家庭與孩子檔案（含遊戲檔案、錢包、初始積木幣、新手禮包）、家長 PIN、孩子模式外框（積木島、帳本、個人頁），以及兒童版 MVP 全部資料表、RLS 與種子資料（5 個任務、9 種商品、10 種建築）。
- **Phase 2：可玩的積木島**：建造模式——從收藏放到島上、移動、收回，存在資料庫，重新登入後還在。手機點一下預覽、再點一下放下（也可以拖曳）；桌面滑鼠移過去預覽、點一下放下；鍵盤用方向鍵移動、Enter 放下、Esc 取消。放置規則（在陸地上、不重疊、收藏裡要有）在伺服器再檢查一次。
- **Phase 3：虛擬經濟**：5 個理財任務（兩步驟：情境與選擇 → 結果與反思；不論選哪個獎勵都一樣，第一次完成才發、重玩只記錄）、升級與解鎖、商店（價格、餘額、等級、限購都由伺服器檢查）、造型（戴帽子）、儲蓄目標（目標金額由伺服器決定、存入／取回、存滿解鎖建築放進收藏）、學習紀錄。所有積木幣變動都記帳，重送同一個請求不會重複扣款或發獎勵。

技術：Next.js 16.4（App Router）＋ TypeScript ＋ Tailwind 4 ＋ Drizzle ORM ＋ PostgreSQL（正式環境用 Supabase，本機與測試用 PGlite）＋ Vitest。

## 快速開始（本機示範模式，不需要 Supabase）

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env.local` 沒有設定任何資料庫時就是**本機示範模式**：

- 資料存在 `web/.data/pglite`（已在 .gitignore），啟動時自動跑 migration。
- 登入頁可以選「示範家長 A／B」，兩個家庭的資料互相看不到，可以用來確認權限隔離。
- 想清空就停掉 dev server，刪掉 `web/.data/`。
- 頁面最上方會有黃色提示列，避免跟正式資料搞混。

## 使用流程與權限

- **登入的是家長**（Supabase Auth，Email＋密碼）。孩子沒有自己的帳密，是家長帳號底下的「孩子檔案」，只收暱稱、年齡區間與頭像顏色。
- 第一次登入 → `/setup` 建立家庭：家庭名稱、家長稱呼、**家長 PIN（4 位數）**、第一位孩子。
- `/family` 家長區：看每位孩子的等級與積木幣、新增孩子、按「開始玩」把裝置交給孩子。
- `/play` 孩子模式：積木島、任務、商店、目標、我的（帳本從頂端的積木幣或桌面側欄進入）。孩子按「換人玩」會回到 `/`「誰要來玩？」。
- 從孩子模式或「誰要來玩？」回到家長區要輸入 PIN；連續輸錯 5 次鎖 10 分鐘。
- 這兩種模式記在 HMAC 簽章的 cookie（`wb_parent` 12 小時、`wb_kid`），綁定登入的家長帳號，竄改或拿到別的帳號都無效；刪掉 cookie 只會回到「誰要來玩？」，不會變成家長。

## 資料與安全設計

- 全部資料表在 `wealth` schema（Supabase Data API 只公開 public，前端碰不到），一律經過伺服器服務層。
- 伺服器以 `DATABASE_URL` 連線，每個請求在交易內 `set local role authenticated` 並帶入 JWT claims（`withUser`），RLS 以「我所屬的家庭」生效，是服務層之外的第二道防線。
- 孩子的資料都帶 `family_id`，用 `(父表 id, family_id)` 複合外鍵串起來，資料庫保證整條鏈屬於同一個家庭。
- 積木幣：`virtual_transactions` 只能新增（權限＋trigger），錢包餘額快照在同一個交易內更新；`postVirtualTransaction` 先鎖錢包、再用 `idempotency_key` 擋重送、再檢查餘額。
- 價格、獎勵、解鎖條件都在 migration 的種子資料裡，前端不能指定。

與規格書第 9 節不同的地方（原因寫在 migration 開頭）：`game_profiles.user_id` 改成 `child_id`；`idempotency_key` 改成同一個錢包內唯一；收藏改成「建築定義」或「造型商品」二選一；另外加了 `purchases` 用唯一索引擋限購商品重複購買；帳本多一個遞增的 `seq` 排序用。

## API

孩子模式的 API 都從簽章 cookie 取得正在玩的孩子，不接受網址或內容指定孩子；會改資料的請求要 `application/json` 而且同源。回應格式 `{ data, meta, errors }`。

| Method | Endpoint | 功能 |
|---|---|---|
| GET | `/api/game/state` | 目前孩子的遊戲狀態 |
| GET | `/api/island` | 島上物件與收藏 |
| POST | `/api/island/objects` | 從收藏放到島上 `{ slug, x, y }` |
| PATCH | `/api/island/objects/:id` | 移動 `{ x, y }` |
| DELETE | `/api/island/objects/:id` | 收回收藏 |
| GET | `/api/wallet`、`/api/wallet/transactions` | 餘額、帳本 |
| GET | `/api/quests`、`/api/quests/:slug` | 任務清單、任務內容 |
| POST | `/api/quests/:slug/complete` | 送出答案 `{ choice }` 或 `{ alloc }`＋`requestId` |
| GET | `/api/shop/items` | 商品與能不能買 |
| POST | `/api/shop/purchase` | 購買 `{ slug, requestId }` |
| POST | `/api/shop/equip` | 戴上／摘下造型 `{ slug \| null }` |
| GET／POST | `/api/goals` | 目標清單／建立 `{ reward }` 或 `{ title, target }` |
| POST | `/api/goals/:id/contribute`、`/withdraw` | 存入／取回 `{ amount, requestId }` |

會動到積木幣的請求都要帶 `requestId`（每次「確認」產生一個 UUID）：重送同一個編號，伺服器只處理一次。


## 接上 Supabase（正式環境）

1. 建立 Supabase 專案。
2. 到 **SQL Editor** 依檔名順序貼上並執行 `supabase/migrations/` 裡的每一份（都可重複執行）：
   1. `20261021000000_phase1_foundation.sql`（全部資料表、RLS、種子資料）
   2. `20261022000000_phase3_economy.sql`（造型、任務重送、目標唯一限制、夢想小屋目標金額）

   - 重跑第一份之後，要把後面的也依序重跑：第一份會重設種子資料與權限。
   - **不要**執行 `supabase/local/auth_stub.sql`，那是給本機 PGlite 模擬 Supabase 用的。
   - 跑完用下面這段確認權限：應該只有 `authenticated`，而且 `virtual_transactions`、`purchases`、`quest_completions` 只有 SELECT 與 INSERT。
     ```sql
     select grantee, table_name, string_agg(privilege_type, ', ' order by privilege_type)
     from information_schema.role_table_grants where table_schema = 'wealth'
     group by 1, 2 order by 2, 1;
     ```
3. 在 `.env.local`（以及 Vercel 的環境變數）設定，格式見 `.env.example`：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（舊專案可用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）
   - `DATABASE_URL`：Supabase「Connect」裡的 **Transaction pooler**（port 6543）連線字串
   - `APP_SECRET`：至少 32 個隨機字元，用來簽章家長／孩子模式的 cookie
4. Authentication → URL Configuration 把 Site URL 設成網站網址，並把 `https://<網址>/auth/callback` 加進 Redirect URLs。
5. Supabase 內建寄信每小時只能寄很少封、而且只寄給組織成員；開放給別的家長註冊前要設定自訂 SMTP。

Supabase 三個變數**只設一半會直接報錯**，正式環境（`NODE_ENV=production`）沒設也會報錯，不會默默改用本機資料庫。

## 指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm test` | Vitest（每個整合測試開一個記憶體內的 PGlite，跑真的 migration 與 RLS） |
| `npm run typecheck` | 產生路由型別並檢查 TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | 正式建置 |

## 字型

- 中文圓體 Chiron GoRound TC（SIL OFL 1.1）**自架**在 `src/app/fonts/chiron/`，依 unicode-range 切成 7 片，瀏覽器只下載用到的那幾片。第 0 片是介面文字，其餘是 Big5 常用字。
- 不用 `next/font/google` 的原因：這套字在 Turbopack 開發模式會固定有某個分片下載失敗，整頁壞掉；自架也讓孩子的瀏覽器不必連到 Google。
- 介面新增了不在 Big5 常用字裡的中文字時，重新產生分片：下載 [ChironGoRoundTC[wght].ttf](https://github.com/google/fonts/tree/main/ofl/chirongoroundtc) 與 OFL.txt 放在同一個資料夾，執行 `python scripts/subset-font.py <ttf 路徑>`（需要 `fonttools` 與 `brotli`）。
- 數字與英文用 Fredoka（`next/font/google`）。

## 結構

```
src/
├── app/
│   ├── page.tsx          入口：依狀態導向，或顯示「誰要來玩？」
│   ├── login/ setup/     登入、建立家庭
│   ├── family/           家長區、輸入 PIN
│   ├── play/             孩子模式（layout 是外框：頂端、導覽、桌面右側欄）
│   ├── api/              遊戲狀態、島嶼、錢包、任務、商店、目標（孩子由簽章 cookie 決定）
│   └── actions.ts        Server Actions（每個都自己檢查登入與模式）
├── components/           積木素材、島嶼建造（island/）、任務卡與目標卡（game/）、對話框與提示（ui/）…
└── lib/
    ├── auth/             session、家長 PIN、模式 cookie、頁面守門
    ├── db/               Drizzle schema、PGlite、withUser
    ├── client/           前端呼叫 API、產生請求編號
    ├── game/             純規則：等級、島嶼格線、任務結果、經濟設定、輸入驗證
    └── services/         家庭、孩子、帳本、島嶼、任務、商店、儲蓄目標
supabase/migrations/      SQL migration（RLS 與權限以這裡為準）
tests/                    Vitest
```

## 尚未完成

- Phase 4：家長中心的學習進度、虛擬零用錢規則、親子討論題目。目前積木幣只有「初始 100」和「任務獎勵」兩個來源（共 150），零用錢在 Phase 4 由家長設定。
- Playwright 端對端測試尚未放進專案（Phase 1–3 的流程是用 scratchpad 的腳本跑過）。
- Supabase 專案還沒建、migration 還沒在 SQL Editor 跑、還沒部署。
