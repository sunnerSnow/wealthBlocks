-- Wealth Blocks Phase 3：任務、商店、儲蓄目標
-- 資料表在 Phase 1 都建好了，這裡只補 Phase 3 需要的欄位、唯一限制與設定值。
-- 本檔可重複執行；重跑 20261021000000_phase1_foundation.sql 之後，要接著重跑本檔（Phase 1 會重設種子資料與權限）。

-- 孩子目前戴著的造型（商店的「造型」商品）
alter table wealth.game_profiles
  add column if not exists equipped_shop_item_id uuid references wealth.shop_items (id);

-- 任務完成紀錄帶請求編號：同一次送出重送時不會多記一筆
alter table wealth.quest_completions add column if not exists request_id uuid;
create unique index if not exists quest_completions_request_uq
  on wealth.quest_completions (game_profile_id, request_id) where request_id is not null;

-- 同一個獎勵建築只能有一個進行中的儲蓄目標
create unique index if not exists savings_goals_active_reward_uq
  on wealth.savings_goals (game_profile_id, reward_building_id)
  where status = 'active' and reward_building_id is not null;

-- 夢想小屋只能靠儲蓄目標取得：目標金額寫在建築定義（前端不能指定）
update wealth.building_definitions
  set unlock_rule = '{"source":"savings_goal","goal_target":150}'::jsonb
  where slug = 'house';
