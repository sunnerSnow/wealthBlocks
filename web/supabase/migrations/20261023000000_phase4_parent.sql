-- Wealth Blocks Phase 4：家長中心（虛擬零用錢規則、孩子設定、設定變更紀錄）
-- 本檔可重複執行；重跑 20261021000000_phase1_foundation.sql 之後，要接著依序重跑後面每一份（Phase 1 會重設權限）。

-- ---------------------------------------------------------------------------
-- child_settings：每位孩子一筆，由家長設定
-- * 零用錢：每 interval_days 天（7 或 14）在台北時間 08:00 發一次，第一次是啟用後的下一個 weekday。
--   allowance_anchor_at 是第 0 期的發放時間，allowance_last_period 是已經發到第幾期。
--   每期的帳本編號是「allowance:<anchor 毫秒>:<期數>」，同一期不會重複發；改了發放日或間隔就換新的 anchor。
-- * allow_child_goals：孩子能不能自己建立儲蓄目標（不能時由家長在家長中心建立）
-- ---------------------------------------------------------------------------
create table if not exists wealth.child_settings (
  child_id              uuid primary key,
  family_id             uuid not null,
  allowance_enabled     boolean not null default false,
  allowance_amount      bigint not null default 20 check (allowance_amount between 1 and 500),
  allowance_interval    integer not null default 7 check (allowance_interval in (7, 14)),
  allowance_weekday     integer not null default 6 check (allowance_weekday between 0 and 6),
  allowance_anchor_at   timestamptz,
  allowance_last_period integer not null default -1 check (allowance_last_period >= -1),
  allow_child_goals     boolean not null default true,
  updated_by            uuid references wealth.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (child_id, family_id) references wealth.children (id, family_id) on delete cascade,
  check (not allowance_enabled or allowance_anchor_at is not null)
);

drop trigger if exists set_updated_at on wealth.child_settings;
create trigger set_updated_at before update on wealth.child_settings for each row execute function wealth.set_updated_at();

-- ---------------------------------------------------------------------------
-- parent_settings_log：家長每一次修改設定都記下時間、操作者與前後的值（只能新增）
-- ---------------------------------------------------------------------------
create table if not exists wealth.parent_settings_log (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references wealth.families (id) on delete cascade,
  child_id      uuid,
  actor_user_id uuid not null references wealth.profiles (id) on delete cascade,
  setting       text not null check (setting in (
                  'allowance_enabled', 'allowance_amount', 'allowance_interval', 'allowance_weekday', 'allow_child_goals')),
  old_value     jsonb,
  new_value     jsonb,
  created_at    timestamptz not null default now(),
  foreign key (child_id, family_id) references wealth.children (id, family_id) on delete cascade
);
create index if not exists parent_settings_log_child_idx on wealth.parent_settings_log (child_id, created_at desc);

drop trigger if exists forbid_mutation on wealth.parent_settings_log;
create trigger forbid_mutation before update or delete on wealth.parent_settings_log
  for each row execute function wealth.forbid_record_mutation();

-- ---------------------------------------------------------------------------
-- 權限與 RLS
-- ---------------------------------------------------------------------------
revoke all on wealth.child_settings, wealth.parent_settings_log from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on wealth.child_settings, wealth.parent_settings_log from %I', r);
    end if;
  end loop;
end
$$;
grant select, insert, update on wealth.child_settings to authenticated;
grant select, insert on wealth.parent_settings_log to authenticated;

alter table wealth.child_settings enable row level security;
alter table wealth.parent_settings_log enable row level security;

drop policy if exists child_settings_family on wealth.child_settings;
create policy child_settings_family on wealth.child_settings for all to authenticated
  using (family_id in (select wealth.my_family_ids()))
  with check (family_id in (select wealth.my_family_ids()));

drop policy if exists parent_settings_log_select on wealth.parent_settings_log;
create policy parent_settings_log_select on wealth.parent_settings_log for select to authenticated
  using (family_id in (select wealth.my_family_ids()));
drop policy if exists parent_settings_log_insert on wealth.parent_settings_log;
create policy parent_settings_log_insert on wealth.parent_settings_log for insert to authenticated
  with check (family_id in (select wealth.my_family_ids()) and actor_user_id = (select auth.uid()));
