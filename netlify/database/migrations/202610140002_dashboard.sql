set search_path=game,pg_temp;
create function game.admin_overview() returns jsonb language plpgsql stable security definer set search_path=game,pg_temp as $$
begin
 if not is_admin() then raise exception '只限管理員'; end if;
 return jsonb_build_object(
 'players',(select count(*) from profiles where not is_admin),
 'completed',(select count(*) from attempts where state='completed'),
 'pending',(select count(*) from attempts where state='pending' and expires_at>now()),
 'feedback',(select count(*) from feedback),
 'reflections',(select count(*) from reflections),
 'redemptions',(select count(*) from redemptions where fulfilled_at is null),
 'families',(select coalesce(jsonb_agg(x),'[]') from (select m.family,count(a.id) as completed from missions m left join attempts a on a.mission_id=m.id and a.state='completed' group by m.family) x),
 'activity',(select coalesce(jsonb_agg(x),'[]') from (select to_char(d,'YYYY-MM-DD') as day,(select count(*) from attempts where state='completed' and completed_at>=d and completed_at<d+interval '1 day') as completed from generate_series(date_trunc('day',now())-interval '13 days',date_trunc('day',now()),interval '1 day') d) x)
 );
end $$;
create function game.admin_players(p_search text default '',p_stage text default 'all',p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path=game,pg_temp as $$
declare result jsonb;
begin
 if not is_admin() then raise exception '只限管理員'; end if;
 if p_page<0 or char_length(p_search)>100 then raise exception '搜尋條件無效'; end if;
 with summary as (
 select p.id,p.display_name,p.email,p.created_at,p.credits,p.is_admin,
 (select count(*) from attempts a where a.player_id=p.id and a.state='completed') as completed,
 (select count(*) from attempts a where a.player_id=p.id and a.state='pending' and expires_at>now()) as pending,
 (select count(*) from feedback f where f.player_id=p.id) as feedback_count,
 (select max(a.created_at) from attempts a where a.player_id=p.id) as last_attempt
 from profiles p where p.display_name ilike '%'||p_search||'%' or p.email ilike '%'||p_search||'%' or p.id::text=p_search
 ), filtered as (select * from summary where p_stage='all' or (p_stage='new' and completed=0) or (p_stage='completed' and completed>0) or (p_stage='pending' and pending>0))
 select jsonb_build_object('total',(select count(*) from filtered),'players',coalesce((select jsonb_agg(x) from (select * from filtered order by created_at desc,id limit 25 offset p_page*25) x),'[]')) into result;
 return result;
end $$;
create function game.admin_player_detail(p_player uuid) returns jsonb language plpgsql stable security definer set search_path=game,pg_temp as $$
begin
 if not is_admin() then raise exception '只限管理員'; end if;
 return jsonb_build_object(
 'profile',(select to_jsonb(p) from profiles p where id=p_player),
 'attempts',(select coalesce(jsonb_agg(a order by a.created_at desc),'[]') from attempts a where player_id=p_player),
 'reflections',(select coalesce(jsonb_agg(r order by r.created_at desc),'[]') from reflections r where player_id=p_player),
 'feedback',(select coalesce(jsonb_agg(f order by f.created_at desc),'[]') from feedback f where player_id=p_player),
 'cards',(select coalesce(jsonb_agg(c),'[]') from cards c where owner_id=p_player),
 'redemptions',(select coalesce(jsonb_agg(r),'[]') from redemptions r where player_id=p_player)
 );
end $$;
create function game.admin_inputs(p_kind text default 'feedback',p_search text default '',p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path=game,pg_temp as $$
declare result jsonb;
begin
 if not is_admin() then raise exception '只限管理員'; end if;
 if p_kind not in ('feedback','reflections') or p_page<0 or char_length(p_search)>100 then raise exception '搜尋條件無效'; end if;
 with inputs as (
 select f.id::text as id,f.player_id,p.display_name,f.body,f.created_at,null::text as mission_id from feedback f join profiles p on p.id=f.player_id where p_kind='feedback'
 union all
 select r.attempt_id::text,r.player_id,p.display_name,r.body,r.created_at,a.mission_id from reflections r join profiles p on p.id=r.player_id join attempts a on a.id=r.attempt_id where p_kind='reflections'
 ), filtered as (select * from inputs where body ilike '%'||p_search||'%' or display_name ilike '%'||p_search||'%')
 select jsonb_build_object('total',(select count(*) from filtered),'inputs',coalesce((select jsonb_agg(x) from (select * from filtered order by created_at desc,id limit 25 offset p_page*25) x),'[]')) into result;
 return result;
end $$;

revoke execute on all functions in schema game from public;
