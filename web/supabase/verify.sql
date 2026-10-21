-- Wealth Blocks 部署檢查（只讀）：在 Supabase SQL Editor 執行，每一列的「結果」都應該是 OK
-- 跑完 migrations/ 的每一份之後執行；有「有問題」就依提示重跑對應的 migration（都可以重複執行）
with t as (
  select c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'wealth' and c.relkind = 'r'
),
g as (
  select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privs
  from information_schema.role_table_grants
  where table_schema = 'wealth' and grantee not in ('postgres', 'supabase_admin')
  group by 1, 2
)
select '1. 資料表 17 張' as 檢查,
  case when (select count(*) from t) = 17 then 'OK' else '有問題：' || (select count(*) from t) || ' 張' end as 結果
union all
select '2. 每張表都開了 RLS',
  coalesce((select '有問題：' || string_agg(relname, ', ') from t where not relrowsecurity), 'OK')
union all
select '3. 只有 authenticated 有資料表權限',
  coalesce((select '有問題：' || string_agg(distinct grantee, ', ') from g where grantee <> 'authenticated'), 'OK')
union all
select '4. 帳本等 4 張表只能讀和新增',
  coalesce((select '有問題：' || string_agg(table_name || '=' || privs, '; ') from g
            where grantee = 'authenticated'
              and table_name in ('virtual_transactions', 'purchases', 'quest_completions', 'parent_settings_log')
              and privs <> 'INSERT,SELECT'), 'OK')
union all
select '5. anon 進不了 wealth schema',
  case when has_schema_privilege('anon', 'wealth', 'usage') then '有問題' else 'OK' end
union all
select '6. 種子資料：任務 5、商品 9、建築 10',
  case when (select count(*) from wealth.quests) = 5
        and (select count(*) from wealth.shop_items) = 9
        and (select count(*) from wealth.building_definitions) = 10 then 'OK'
       else '有問題：任務 ' || (select count(*) from wealth.quests) || '、商品 ' || (select count(*) from wealth.shop_items)
            || '、建築 ' || (select count(*) from wealth.building_definitions) end
union all
select '7. 第 2、3 份已套用',
  coalesce('有問題：缺 ' || nullif(concat_ws('、',
    case when not exists (select 1 from pg_attribute where attrelid = 'wealth.game_profiles'::regclass
                          and attname = 'equipped_shop_item_id' and not attisdropped) then '造型欄位' end,
    case when not exists (select 1 from pg_attribute where attrelid = 'wealth.quest_completions'::regclass
                          and attname = 'request_id' and not attisdropped) then '任務請求編號' end,
    case when (select count(*) from pg_indexes where schemaname = 'wealth'
               and indexname in ('quest_completions_request_uq', 'savings_goals_active_reward_uq')) < 2 then '唯一索引' end,
    case when not exists (select 1 from wealth.building_definitions
                          where slug = 'house' and unlock_rule ->> 'goal_target' = '150') then '夢想小屋目標金額' end,
    case when to_regclass('wealth.child_settings') is null then '孩子設定表' end,
    case when to_regclass('wealth.parent_settings_log') is null then '設定紀錄表' end
  ), ''), 'OK')
union all
select '8. authenticated 每張表都有權限',
  case when (select count(*) from g where grantee = 'authenticated') = (select count(*) from t) then 'OK'
       else '有問題：缺 ' || coalesce((select string_agg(relname, ', ') from t
                                      where relname not in (select table_name from g where grantee = 'authenticated')), '?') end;
