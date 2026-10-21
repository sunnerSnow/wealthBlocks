-- Wealth Blocks Phase 1：專案基礎（兒童版 MVP 的全部資料表、RLS、索引與種子資料）
--
-- 設計重點：
-- * 全部放在 wealth schema：Supabase 的 Data API 只公開 public，這些表不會被前端直接讀寫，
--   一律經過伺服器的服務層（價格、獎勵、餘額都由伺服器決定）。
-- * 登入的是家長（auth.users）。孩子是家長帳號底下的「孩子檔案」(children)，沒有自己的帳密；
--   規格 9.2 的 game_profiles.user_id 因此改成 child_id。children.auth_user_id 預留給日後讓孩子自己登入。
-- * 孩子的資料都帶 family_id，並用 (父表 id, family_id) 複合外鍵連到上層：資料庫保證整條鏈屬於同一個家庭。
--   RLS 只認「我所屬的家庭」；「孩子模式只能看自己」由伺服器依簽章 cookie 控制。
-- * 伺服器以 postgres 連線後，每個請求在交易內 set local role authenticated 並帶入 JWT claims，
--   服務層漏寫條件時 RLS 仍會擋下跨家庭存取。
-- * 積木幣一律 bigint。帳本（virtual_transactions）、購買與任務完成紀錄只能新增；
--   錢包餘額是快照，與帳本在同一個交易內更新。更正錯誤要新增反向交易。
-- * 規格 9.3 的 idempotency_key 全域唯一，這裡改成「同一個錢包內唯一」。
-- * 規格 9.6 的 user_inventory 只對應 shop_item；這裡改成「建築定義」或「商品（造型）」二選一，
--   儲蓄目標換到的夢想小屋（不在商店販售）才放得進收藏。quantity 是「還沒放到島上」的數量。
-- * 規格要求限購商品用資料庫唯一限制擋重複購買：另外記一張 purchases，限購商品 (遊戲檔案, 商品) 唯一。
--
-- 本檔可重複執行（if not exists、drop policy if exists、種子資料 on conflict do update）。

create schema if not exists wealth;

-- ---------------------------------------------------------------------------
-- 共用：updated_at
-- ---------------------------------------------------------------------------
create or replace function wealth.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles：對應 auth.users（家長）
-- ---------------------------------------------------------------------------
create table if not exists wealth.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text not null default '' check (char_length(display_name) <= 20),
  avatar_key     text check (avatar_key is null or avatar_key ~ '^[a-z][a-z0-9-]{0,39}$'),
  preferred_mode text not null default 'kids' check (preferred_mode in ('kids', 'adult')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- families：家長 PIN 用來進入家長區（雜湊後存放，連續輸錯會暫時鎖住）
-- ---------------------------------------------------------------------------
create table if not exists wealth.families (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(btrim(name)) between 1 and 20),
  created_by          uuid not null references wealth.profiles (id) on delete cascade,
  parent_pin_hash     text check (parent_pin_hash is null or parent_pin_hash like 'scrypt$%'),
  pin_failed_attempts integer not null default 0 check (pin_failed_attempts >= 0),
  pin_locked_until    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists wealth.family_members (
  family_id   uuid not null references wealth.families (id) on delete cascade,
  user_id     uuid not null references wealth.profiles (id) on delete cascade,
  role        text not null check (role in ('parent', 'child')),
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  primary key (family_id, user_id)
);
-- MVP：一個帳號只屬於一個家庭
create unique index if not exists family_members_user_uq on wealth.family_members (user_id);

-- ---------------------------------------------------------------------------
-- children：孩子檔案（只收暱稱、年齡區間、頭像，不收真實姓名或聯絡方式）
-- ---------------------------------------------------------------------------
create table if not exists wealth.children (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references wealth.families (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 12),
  avatar_key   text not null default 'sun' check (avatar_key ~ '^[a-z][a-z0-9-]{0,39}$'),
  age_band     text not null check (age_band in ('6-8', '9-10', '11-12')),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz,
  unique (id, family_id)
);
create index if not exists children_family_idx on wealth.children (family_id);

-- ---------------------------------------------------------------------------
-- game_profiles：experience 是累計經驗值，level 由伺服器依門檻一起更新
-- ---------------------------------------------------------------------------
create table if not exists wealth.game_profiles (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null,
  child_id   uuid not null,
  game_mode  text not null default 'kids' check (game_mode = 'kids'),
  level      integer not null default 1 check (level between 1 and 99),
  experience integer not null default 0 check (experience >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  unique (child_id, game_mode),
  foreign key (child_id, family_id) references wealth.children (id, family_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 虛擬錢包與帳本
-- ---------------------------------------------------------------------------
create table if not exists wealth.virtual_wallets (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null,
  game_profile_id uuid not null unique,
  currency_code   text not null default 'BLOCK_COIN' check (currency_code = 'BLOCK_COIN'),
  balance         bigint not null default 0 check (balance >= 0),
  updated_at      timestamptz not null default now(),
  unique (id, family_id),
  foreign key (game_profile_id, family_id) references wealth.game_profiles (id, family_id) on delete cascade
);

create table if not exists wealth.virtual_transactions (
  id              uuid primary key default gen_random_uuid(),
  -- 同一個資料庫交易內的 now() 都相同，排序帳本改用遞增序號
  seq             bigint generated always as identity,
  family_id       uuid not null,
  wallet_id       uuid not null,
  type            text not null check (type in (
                    'initial_grant', 'allowance', 'quest_reward', 'purchase',
                    'goal_contribution', 'goal_withdrawal', 'admin_adjustment')),
  amount          bigint not null check (amount <> 0),
  balance_after   bigint not null check (balance_after >= 0),
  reference_type  text check (reference_type is null or reference_type in (
                    'quest', 'shop_item', 'savings_goal', 'allowance_rule', 'virtual_transaction')),
  reference_id    uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  description     text not null check (char_length(description) between 1 and 120),
  created_at      timestamptz not null default now(),
  unique (id, family_id),
  unique (wallet_id, idempotency_key),
  foreign key (wallet_id, family_id) references wealth.virtual_wallets (id, family_id) on delete cascade,
  -- 收入類型一定是正數、支出類型一定是負數；只有經授權的調整可以兩者皆可
  check (
    (type in ('initial_grant', 'allowance', 'quest_reward', 'goal_withdrawal') and amount > 0)
    or (type in ('purchase', 'goal_contribution') and amount < 0)
    or type = 'admin_adjustment'
  )
);
create index if not exists virtual_transactions_wallet_idx on wealth.virtual_transactions (wallet_id, seq desc);

-- ---------------------------------------------------------------------------
-- 共用主檔：建築定義、商品、任務（所有登入者可讀，只能由 migration 維護）
-- ---------------------------------------------------------------------------
create table if not exists wealth.building_definitions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,39}$'),
  name        text not null check (char_length(name) between 1 and 20),
  category    text not null check (category in ('building', 'deco', 'terrain', 'nature')),
  asset_key   text not null,
  width       integer not null check (width between 1 and 4),
  height      integer not null check (height between 1 and 4),
  unlock_rule jsonb not null default '{}'::jsonb,
  cost        bigint not null default 0 check (cost >= 0),
  is_movable  boolean not null default true,
  is_flat     boolean not null default false,
  is_active   boolean not null default true,
  description text not null default ''
);

create table if not exists wealth.shop_items (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,39}$'),
  name                   text not null check (char_length(name) between 1 and 20),
  description            text not null default '',
  category               text not null check (category in ('deco', 'building', 'terrain', 'wear')),
  price                  bigint not null check (price > 0),
  asset_key              text not null,
  is_active              boolean not null default true,
  is_unique              boolean not null default false,
  min_level              integer not null default 1 check (min_level >= 1),
  building_definition_id uuid references wealth.building_definitions (id),
  sort_order             integer not null default 0,
  -- 造型商品沒有建築；其他商品一定對應一個可以放上島的建築定義
  check ((category = 'wear') = (building_definition_id is null))
);

create table if not exists wealth.quests (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,39}$'),
  title        text not null check (char_length(title) between 1 and 30),
  category     text not null check (category in ('earn', 'spend', 'save', 'plan', 'share', 'risk')),
  description  text not null default '',
  age_min      integer not null default 6 check (age_min between 3 and 18),
  age_max      integer not null default 12 check (age_max between 3 and 18),
  min_level    integer not null default 1 check (min_level >= 1),
  reward_coins bigint not null default 0 check (reward_coins >= 0),
  reward_xp    integer not null default 0 check (reward_xp >= 0),
  content_json jsonb not null,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  check (age_min <= age_max)
);

-- ---------------------------------------------------------------------------
-- 任務完成紀錄：同一個任務只有第一次完成會發獎勵（rewarded），重玩只記錄選擇
-- ---------------------------------------------------------------------------
create table if not exists wealth.quest_completions (
  id                    uuid primary key default gen_random_uuid(),
  family_id             uuid not null,
  game_profile_id       uuid not null,
  quest_id              uuid not null references wealth.quests (id),
  selected_option       text not null check (char_length(selected_option) between 1 and 60),
  result_json           jsonb not null default '{}'::jsonb,
  reward_transaction_id uuid,
  rewarded              boolean not null default false,
  completed_at          timestamptz not null default now(),
  foreign key (game_profile_id, family_id) references wealth.game_profiles (id, family_id) on delete cascade,
  foreign key (reward_transaction_id, family_id) references wealth.virtual_transactions (id, family_id),
  check (reward_transaction_id is null or rewarded)
);
create unique index if not exists quest_completions_rewarded_uq
  on wealth.quest_completions (game_profile_id, quest_id) where rewarded;
create index if not exists quest_completions_profile_idx on wealth.quest_completions (game_profile_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- 儲蓄目標
-- ---------------------------------------------------------------------------
create table if not exists wealth.savings_goals (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null,
  game_profile_id    uuid not null,
  title              text not null check (char_length(btrim(title)) between 1 and 12),
  target_amount      bigint not null check (target_amount between 1 and 100000),
  saved_amount       bigint not null default 0 check (saved_amount >= 0),
  reward_building_id uuid references wealth.building_definitions (id),
  status             text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  completed_at       timestamptz,
  unique (id, family_id),
  foreign key (game_profile_id, family_id) references wealth.game_profiles (id, family_id) on delete cascade,
  check (saved_amount <= target_amount),
  check ((status = 'completed') = (completed_at is not null))
);
create index if not exists savings_goals_profile_idx on wealth.savings_goals (game_profile_id, status);

-- ---------------------------------------------------------------------------
-- 收藏與購買
-- ---------------------------------------------------------------------------
create table if not exists wealth.user_inventory (
  id                     uuid primary key default gen_random_uuid(),
  family_id              uuid not null,
  game_profile_id        uuid not null,
  building_definition_id uuid references wealth.building_definitions (id),
  shop_item_id           uuid references wealth.shop_items (id),
  quantity               integer not null default 0 check (quantity between 0 and 999),
  acquired_at            timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  foreign key (game_profile_id, family_id) references wealth.game_profiles (id, family_id) on delete cascade,
  check ((building_definition_id is null) <> (shop_item_id is null)),
  unique (game_profile_id, building_definition_id),
  unique (game_profile_id, shop_item_id)
);

create table if not exists wealth.purchases (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null,
  game_profile_id uuid not null,
  shop_item_id    uuid not null references wealth.shop_items (id),
  transaction_id  uuid not null unique,
  price           bigint not null check (price > 0),
  is_unique       boolean not null,
  created_at      timestamptz not null default now(),
  foreign key (game_profile_id, family_id) references wealth.game_profiles (id, family_id) on delete cascade,
  foreign key (transaction_id, family_id) references wealth.virtual_transactions (id, family_id)
);
create unique index if not exists purchases_unique_item_uq
  on wealth.purchases (game_profile_id, shop_item_id) where is_unique;

-- ---------------------------------------------------------------------------
-- 島嶼物件：格線 9×9（座標 0–8）；是否在陸地上、是否重疊由伺服器驗證
-- ---------------------------------------------------------------------------
create table if not exists wealth.island_objects (
  id                     uuid primary key default gen_random_uuid(),
  family_id              uuid not null,
  game_profile_id        uuid not null,
  building_definition_id uuid not null references wealth.building_definitions (id),
  grid_x                 integer not null check (grid_x between 0 and 8),
  grid_y                 integer not null check (grid_y between 0 and 8),
  rotation               integer not null default 0 check (rotation in (0, 90, 180, 270)),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  foreign key (game_profile_id, family_id) references wealth.game_profiles (id, family_id) on delete cascade
);
create index if not exists island_objects_profile_idx on wealth.island_objects (game_profile_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'families', 'children', 'game_profiles', 'virtual_wallets',
                           'savings_goals', 'user_inventory', 'island_objects'] loop
    execute format('drop trigger if exists set_updated_at on wealth.%I', t);
    execute format('create trigger set_updated_at before update on wealth.%I for each row execute function wealth.set_updated_at()', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 原始紀錄不可改寫：帳本、購買、任務完成紀錄不能 update；
-- delete 只有在同一個交易內明確 set local wealth.allow_purge = 'on' 時允許（給「刪除我的資料」流程用）。
-- ---------------------------------------------------------------------------
create or replace function wealth.forbid_record_mutation() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('wealth.allow_purge', true) = 'on' then
    return old;
  end if;
  raise exception '% 是原始紀錄，不能 %；更正請新增反向紀錄', tg_table_name, lower(tg_op)
    using errcode = 'insufficient_privilege';
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['virtual_transactions', 'purchases', 'quest_completions'] loop
    execute format('drop trigger if exists forbid_mutation on wealth.%I', t);
    execute format('create trigger forbid_mutation before update or delete on wealth.%I for each row execute function wealth.forbid_record_mutation()', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- RLS 輔助：我所屬的家庭（security definer，避免 family_members 的政策查自己造成遞迴）
-- ---------------------------------------------------------------------------
create or replace function wealth.my_family_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select family_id from wealth.family_members where user_id = (select auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- 權限：只開給 authenticated（伺服器 set local role 進來），anon 什麼都沒有
-- ---------------------------------------------------------------------------
revoke all on schema wealth from public;
revoke all on all tables in schema wealth from public;
revoke all on function wealth.my_family_ids() from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema wealth from %I', r);
    end if;
  end loop;
end
$$;
grant usage on schema wealth to authenticated;
grant execute on function wealth.my_family_ids() to authenticated;
grant select, insert, update on wealth.profiles, wealth.families, wealth.children, wealth.game_profiles,
  wealth.virtual_wallets, wealth.savings_goals to authenticated;
grant select, insert on wealth.family_members, wealth.virtual_transactions, wealth.purchases,
  wealth.quest_completions to authenticated;
grant select, insert, update, delete on wealth.user_inventory, wealth.island_objects to authenticated;
grant select on wealth.building_definitions, wealth.shop_items, wealth.quests to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'families', 'family_members', 'children', 'game_profiles',
                           'virtual_wallets', 'virtual_transactions', 'building_definitions', 'shop_items',
                           'quests', 'quest_completions', 'savings_goals', 'user_inventory', 'purchases',
                           'island_objects'] loop
    execute format('alter table wealth.%I enable row level security', t);
  end loop;
end
$$;

drop policy if exists profiles_own on wealth.profiles;
create policy profiles_own on wealth.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 建立者在加入成員之前也要看得到自己剛建立的家庭
drop policy if exists families_select on wealth.families;
create policy families_select on wealth.families for select to authenticated
  using (id in (select wealth.my_family_ids()) or created_by = (select auth.uid()));
drop policy if exists families_insert on wealth.families;
create policy families_insert on wealth.families for insert to authenticated
  with check (created_by = (select auth.uid()));
drop policy if exists families_update on wealth.families;
create policy families_update on wealth.families for update to authenticated
  using (id in (select wealth.my_family_ids())) with check (id in (select wealth.my_family_ids()));

-- 只能把「自己」以家長身分加進「自己建立的」家庭；之後的邀請流程另外處理
drop policy if exists family_members_select on wealth.family_members;
create policy family_members_select on wealth.family_members for select to authenticated
  using (family_id in (select wealth.my_family_ids()));
drop policy if exists family_members_insert on wealth.family_members;
create policy family_members_insert on wealth.family_members for insert to authenticated
  with check (
    user_id = (select auth.uid()) and role = 'parent'
    and exists (select 1 from wealth.families f where f.id = family_id and f.created_by = (select auth.uid()))
  );

-- 孩子的資料：同一個家庭的成員才能存取
do $$
declare t text;
begin
  foreach t in array array['children', 'game_profiles', 'virtual_wallets', 'savings_goals',
                           'user_inventory', 'island_objects'] loop
    execute format('drop policy if exists %I on wealth.%I', t || '_family', t);
    execute format(
      'create policy %I on wealth.%I for all to authenticated
         using (family_id in (select wealth.my_family_ids()))
         with check (family_id in (select wealth.my_family_ids()))', t || '_family', t);
  end loop;
  -- 原始紀錄只開 select 與 insert（權限也只給這兩個）
  foreach t in array array['virtual_transactions', 'purchases', 'quest_completions'] loop
    execute format('drop policy if exists %I on wealth.%I', t || '_select', t);
    execute format('create policy %I on wealth.%I for select to authenticated using (family_id in (select wealth.my_family_ids()))', t || '_select', t);
    execute format('drop policy if exists %I on wealth.%I', t || '_insert', t);
    execute format('create policy %I on wealth.%I for insert to authenticated with check (family_id in (select wealth.my_family_ids()))', t || '_insert', t);
  end loop;
  -- 主檔：大家都看得到啟用中的項目
  foreach t in array array['building_definitions', 'shop_items', 'quests'] loop
    execute format('drop policy if exists %I on wealth.%I', t || '_read', t);
    execute format('create policy %I on wealth.%I for select to authenticated using (is_active)', t || '_read', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 種子資料：建築定義
-- ---------------------------------------------------------------------------
insert into wealth.building_definitions (slug, name, category, asset_key, width, height, unlock_rule, is_movable, is_flat, description) values
  ('tent',    '起點帳篷', 'building', 'tent',    1, 1, '{"source":"starter"}',        true,  false, '你在積木島上的第一個家，一切從這裡開始。'),
  ('rock',    '島嶼岩石', 'nature',   'rock',    1, 1, '{"source":"island"}',         false, false, '島上本來就有的大石頭，不能移動。'),
  ('tree',    '小樹',     'deco',     'tree',    1, 1, '{"source":"shop"}',           true,  false, '讓島嶼多一點綠意，也能幫居民遮陽。'),
  ('flower',  '花圃',     'deco',     'flower',  1, 1, '{"source":"shop"}',           true,  false, '三種顏色的小花，放在路邊特別好看。'),
  ('lamp',    '路燈',     'deco',     'lamp',    1, 1, '{"source":"shop"}',           true,  false, '晚上也能看清楚回家的路。'),
  ('road',    '石板路',   'terrain',  'road',    1, 1, '{"source":"shop"}',           true,  true,  '一格一格鋪出島上的小路。'),
  ('pond',    '小湖泊',   'terrain',  'pond',    2, 2, '{"source":"shop"}',           true,  true,  '長著睡蓮的小湖。'),
  ('shop',    '小商店',   'building', 'shop',    2, 2, '{"source":"shop"}',           true,  false, '島上的第一家商店，居民可以在這裡買東西。'),
  ('library', '圖書館',   'building', 'library', 2, 2, '{"source":"shop","min_level":2}', true, false, '可以借書、學新知識的地方。'),
  ('house',   '夢想小屋', 'building', 'house',   2, 2, '{"source":"savings_goal"}',   true,  false, '紅色積木屋頂的小屋。存滿儲蓄目標就能解鎖。')
on conflict (slug) do update set
  name = excluded.name, category = excluded.category, asset_key = excluded.asset_key, width = excluded.width,
  height = excluded.height, unlock_rule = excluded.unlock_rule, is_movable = excluded.is_movable,
  is_flat = excluded.is_flat, description = excluded.description;

-- ---------------------------------------------------------------------------
-- 種子資料：商品（價格只在這裡決定，前端不能指定）
-- ---------------------------------------------------------------------------
insert into wealth.shop_items (slug, name, description, category, price, asset_key, is_unique, min_level, building_definition_id, sort_order)
select v.slug, v.name, v.description, v.category, v.price, v.asset_key, v.is_unique, v.min_level, b.id, v.sort_order
from (values
  ('tree',         '小樹',   '讓島嶼多一點綠意，也能幫居民遮陽。',     'deco',     20,  'tree',         false, 1, 'tree',    10),
  ('flower',       '花圃',   '三種顏色的小花，放在路邊特別好看。',     'deco',     15,  'flower',       false, 1, 'flower',  20),
  ('lamp',         '路燈',   '晚上也能看清楚回家的路。',               'deco',     25,  'lamp',         false, 1, 'lamp',    30),
  ('road',         '石板路', '一格一格鋪出島上的小路。',               'terrain',  5,   'road',         false, 1, 'road',    40),
  ('pond',         '小湖泊', '長著睡蓮的小湖。',                       'terrain',  60,  'pond',         false, 1, 'pond',    50),
  ('shop',         '小商店', '島上的第一家商店，居民可以在這裡買東西。', 'building', 120, 'shop',         true,  1, 'shop',    60),
  ('library',      '圖書館', '可以借書、學新知識的地方。',             'building', 160, 'library',      true,  2, 'library', 70),
  ('hat-explorer', '探險帽', '戴上它，去島上每個角落探險。',           'wear',     30,  'hat-explorer', true,  1, null,      80),
  ('hat-cap',      '棒球帽', '深藍色的帽子，前面有一顆黃色星星。',     'wear',     25,  'hat-cap',      true,  1, null,      90)
) as v (slug, name, description, category, price, asset_key, is_unique, min_level, building_slug, sort_order)
left join wealth.building_definitions b on b.slug = v.building_slug
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, category = excluded.category, price = excluded.price,
  asset_key = excluded.asset_key, is_unique = excluded.is_unique, min_level = excluded.min_level,
  building_definition_id = excluded.building_definition_id, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 種子資料：理財任務
-- content_json：story 段落裡 **數字** 會顯示成重點；options 的 stats／pros／cons 是結果頁的內容。
-- 不論選哪一個，獎勵都一樣（獎勵的是參與與思考，不是「正確答案」）。
-- ---------------------------------------------------------------------------
insert into wealth.quests (slug, title, category, description, min_level, reward_coins, reward_xp, sort_order, content_json) values
('toy-store', '夢想玩具店', 'spend', '很想要的玩具和存錢目標，該怎麼選？', 1, 10, 30, 10, $json${
  "kind": "choice",
  "art": ["car", "house"],
  "story": ["島上的玩具店新進了一台遙控玩具車，售價 **60** 積木幣。", "你也正在為 **150** 積木幣的「夢想小屋」存錢。故事裡，你現在有 **100** 積木幣。"],
  "resources": [{"label": "故事裡的錢包", "value": 100}, {"label": "玩具車", "value": 60}, {"label": "夢想小屋", "value": 150}],
  "ask": "你會怎麼做？",
  "options": [
    {"key": "A", "text": "買下玩具車", "hint": "花 60，手上剩 40",
     "stats": [{"label": "手上可用", "value": 40, "unit": "積木幣"}, {"label": "夢想小屋還差", "value": 150, "unit": "積木幣"}],
     "goal": {"saved": 0, "target": 150},
     "pros": ["馬上就能玩到想要的玩具車。", "手上還有 40 積木幣可以用。"],
     "cons": ["夢想小屋還沒開始存，要等比較久才能蓋好。"]},
    {"key": "B", "text": "先不買，100 全部存起來", "hint": "全部放進夢想小屋",
     "stats": [{"label": "手上可用", "value": 0, "unit": "積木幣"}, {"label": "夢想小屋還差", "value": 50, "unit": "積木幣"}],
     "goal": {"saved": 100, "target": 150},
     "pros": ["一次存到三分之二，離夢想小屋只差 50。"],
     "cons": ["手上沒有積木幣，臨時想用錢會不方便。", "玩具車也要等一等。"]},
    {"key": "C", "text": "暫時不買，存 70、留 30", "hint": "一部分存起來，一部分日常用",
     "stats": [{"label": "手上可用", "value": 30, "unit": "積木幣"}, {"label": "夢想小屋還差", "value": 80, "unit": "積木幣"}],
     "goal": {"saved": 70, "target": 150},
     "pros": ["一邊存錢，一邊保留日常要用的錢，比較有彈性。"],
     "cons": ["玩具車和夢想小屋都還要再等一陣子。"]}
  ],
  "reflect": "如果玩具車下個月會打折，你的決定會改變嗎？"
}$json$::jsonb),
('bakery-helper', '麵包店小幫手', 'earn', '用不同方式幫忙，收入和花的時間也不一樣。', 1, 15, 35, 20, $json${
  "kind": "choice",
  "art": ["shop"],
  "story": ["島上的麵包店今天訂單特別多，老闆想請小幫手。", "你有一個下午的時間，可以選一種幫忙方式。"],
  "ask": "你想怎麼幫忙？",
  "options": [
    {"key": "A", "text": "自己送 3 份麵包", "hint": "花 1 小時，收入 30",
     "stats": [{"label": "你的收入", "value": 30, "unit": "積木幣"}, {"label": "花的時間", "value": 1, "unit": "小時"}],
     "pros": ["付出時間就能拿到收入，很穩定。"],
     "cons": ["送麵包要花力氣，這段時間不能做別的事。"]},
    {"key": "B", "text": "幫忙設計新招牌", "hint": "花 2 小時，今天收入 20",
     "stats": [{"label": "今天收入", "value": 20, "unit": "積木幣"}, {"label": "之後可能多", "value": 20, "unit": "積木幣"}, {"label": "花的時間", "value": 2, "unit": "小時"}],
     "pros": ["用創意讓麵包店變得更好，未來可能賺更多。"],
     "cons": ["要等比較久，而且客人不一定會變多。"]},
    {"key": "C", "text": "和朋友一起送 6 份", "hint": "花 1 小時，兩人平分 50",
     "stats": [{"label": "你的收入", "value": 25, "unit": "積木幣"}, {"label": "完成訂單", "value": 6, "unit": "份"}, {"label": "花的時間", "value": 1, "unit": "小時"}],
     "pros": ["合作可以完成更多工作，也比較有趣。"],
     "cons": ["收入要和朋友分，每個人拿到的比自己做少一點。"]}
  ],
  "reflect": "除了幫忙送東西，還有哪些事情可以賺到收入？"
}$json$::jsonb),
('three-jars', '零用錢分三罐', 'plan', '把 50 積木幣分到花用、儲蓄和分享。', 1, 15, 40, 30, $json${
  "kind": "alloc",
  "art": ["jar"],
  "story": ["這週你拿到 **50** 積木幣零用錢。", "試著把它分到三個罐子裡，每次可以調整 5 積木幣。"],
  "ask": "你會怎麼分？",
  "alloc": {"total": 50, "step": 5, "jars": [
    {"key": "spend", "label": "花用", "desc": "現在想買的東西"},
    {"key": "save", "label": "儲蓄", "desc": "以後的大目標"},
    {"key": "share", "label": "分享", "desc": "幫助別人或送禮物"}
  ]},
  "reflect": "如果下週有很想買的東西，你會調整哪一個罐子？"
}$json$::jsonb),
('rainy-day', '島民的雨天', 'share', '花店屋頂被雨打壞了，你會怎麼幫忙？', 2, 10, 30, 40, $json${
  "kind": "choice",
  "art": ["cloud", "flower"],
  "story": ["一場大雨讓島上花店的屋頂破了，店長需要 **40** 積木幣修理。", "故事裡，你有 **80** 積木幣，正在存錢買新的腳踏車。"],
  "resources": [{"label": "故事裡的錢包", "value": 80}, {"label": "修理費", "value": 40}],
  "ask": "你會怎麼做？",
  "options": [
    {"key": "A", "text": "拿出 40 幫店長修屋頂", "hint": "手上剩 40",
     "stats": [{"label": "手上剩下", "value": 40, "unit": "積木幣"}, {"label": "花店屋頂", "value": "修好了"}],
     "pros": ["店長馬上就能重新開店。"], "cons": ["腳踏車要再等一陣子。"]},
    {"key": "B", "text": "出 10，再邀大家一起出一點", "hint": "手上剩 70",
     "stats": [{"label": "手上剩下", "value": 70, "unit": "積木幣"}, {"label": "花店屋頂", "value": "大家一起湊"}],
     "pros": ["一起幫忙，每個人的負擔都比較小。"], "cons": ["要花時間邀請大家，不一定馬上湊齊。"]},
    {"key": "C", "text": "不出錢，去幫忙整理店面", "hint": "手上還是 80",
     "stats": [{"label": "手上剩下", "value": 80, "unit": "積木幣"}, {"label": "你付出的", "value": "時間和力氣"}],
     "pros": ["幫助別人不一定要用錢，時間和力氣也很珍貴。"], "cons": ["屋頂的修理費還需要其他人幫忙。"]},
    {"key": "D", "text": "這次先不幫忙", "hint": "照原本的計畫存錢",
     "stats": [{"label": "手上剩下", "value": 80, "unit": "積木幣"}, {"label": "花店屋頂", "value": "還在等修理"}],
     "pros": ["可以照原本的計畫存錢買腳踏車。"], "cons": ["花店可能要等比較久才能重新開店。", "下次也可以用其他方式表達關心。"]}
  ],
  "reflect": "幫助別人的時候，除了錢，還可以付出什麼？"
}$json$::jsonb),
('two-seeds', '兩種種子', 'risk', '穩穩長大的種子，和可能大豐收也可能失敗的種子。', 3, 15, 40, 50, $json${
  "kind": "choice",
  "art": ["flower"],
  "story": ["春天到了，花園裡有 **4** 格可以種種子。", "向日葵種子每顆一定開 **1** 朵花；魔法種子每顆可能開 **3** 朵，也可能 **1** 朵都不開。"],
  "ask": "你會怎麼種？",
  "options": [
    {"key": "A", "text": "4 格都種向日葵", "hint": "一定有 4 朵",
     "stats": [{"label": "最少", "value": 4, "unit": "朵"}, {"label": "最多", "value": 4, "unit": "朵"}],
     "pros": ["結果很確定，不會一朵都沒有。"], "cons": ["不會有大豐收的驚喜。"]},
    {"key": "B", "text": "4 格都種魔法種子", "hint": "可能 12 朵，也可能 0 朵",
     "stats": [{"label": "最少", "value": 0, "unit": "朵"}, {"label": "最多", "value": 12, "unit": "朵"}],
     "pros": ["運氣好的話，花會比向日葵多很多。"], "cons": ["運氣不好的話，花園可能空空的。"]},
    {"key": "C", "text": "各種 2 格", "hint": "至少 2 朵，最多 8 朵",
     "stats": [{"label": "最少", "value": 2, "unit": "朵"}, {"label": "最多", "value": 8, "unit": "朵"}],
     "pros": ["一定有花，也保留大豐收的機會。這就是「分散」。"], "cons": ["最多的時候比全種魔法種子少。"]}
  ],
  "reflect": "如果這些花是要送給朋友的生日禮物，你會怎麼種？"
}$json$::jsonb)
on conflict (slug) do update set
  title = excluded.title, category = excluded.category, description = excluded.description,
  min_level = excluded.min_level, reward_coins = excluded.reward_coins, reward_xp = excluded.reward_xp,
  sort_order = excluded.sort_order, content_json = excluded.content_json;
