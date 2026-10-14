set search_path=game,pg_temp;
create table game.ai_monthly_usage(month date primary key,count integer not null check(count>=0));
create table game.ai_requests (
 id uuid primary key, player_id uuid not null references game.profiles,
 state text not null check(state in ('pending','completed','failed')), reply text,
 input_tokens integer, output_tokens integer, created_at timestamptz not null default now()
);
-- Atomic reservation: 20 attempts per user/day, 500 per site/month.
-- Conservative request cap, not a promise about the eventual Netlify invoice.
create function game.reserve_ai_request(p_request uuid) returns jsonb language plpgsql security definer set search_path=game,pg_temp as $$
declare prior ai_requests; n integer; now_month date := date_trunc('month',now() at time zone 'UTC')::date;
begin
 perform id from profiles where id=game.current_user_id() for update;
 if not found then raise exception '請先登入'; end if;
 select * into prior from ai_requests where id=p_request;
 if found then
  if prior.player_id<>game.current_user_id() then raise exception '沒有權限'; end if;
  if prior.state='completed' then return jsonb_build_object('reply',prior.reply); end if;
  raise exception '這次請求已處理或進行中，請重新送出';
 end if;
 insert into ai_monthly_usage(month,count) values(now_month,1)
 on conflict(month) do update set count=ai_monthly_usage.count+1 returning count into n;
 if n>500 then raise exception '本月全站 AI 試行額度已用完，請聯絡管理員'; end if;
 perform game.claim_ai_quota(game.current_user_id());
 insert into ai_requests(id,player_id,state) values(p_request,game.current_user_id(),'pending');
 return '{}'::jsonb;
end $$;
-- Clearing includes retry-cache replies, so deleted conversations cannot be replayed.
create or replace function game.clear_chat() returns void language plpgsql security definer set search_path=game,pg_temp as $$
begin
 delete from chat_messages where player_id=game.current_user_id();
 update ai_requests set reply=null,state='failed' where player_id=game.current_user_id();
end $$;
revoke all on all tables in schema game from public;
revoke execute on all functions in schema game from public;
