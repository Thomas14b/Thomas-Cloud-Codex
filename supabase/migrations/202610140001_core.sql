-- All inventory mutations run inside Postgres transactions, never in the browser.
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null check (char_length(display_name) between 1 and 60),
 email text not null default '', credits integer not null default 0 check(credits >= 0),
 is_admin boolean not null default false, created_at timestamptz not null default now()
);
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select is_admin from profiles where id=auth.uid()),false)
$$;
create function public.on_signup() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into profiles(id,display_name,email) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'新同學'),60),coalesce(new.email,''));
 return new;
end $$;
create trigger signup_profile after insert on auth.users for each row execute function public.on_signup();
create function public.on_email_change() returns trigger language plpgsql security definer set search_path=public as $$
begin update profiles set email=coalesce(new.email,'') where id=new.id; return new; end $$;
create trigger profile_email after update of email on auth.users for each row execute function public.on_email_change();

create table public.missions (
 id text primary key check(id ~ '^[A-Z0-9_-]{3,30}$'), title text not null check(char_length(title) between 1 and 100),
 family text not null check(family in ('敢問雞','歪歪貓','隨風雀','問問兔','出聲鴨','再嚟龜')),
 description text not null check(char_length(description) between 1 and 2000), question text not null check(char_length(question) between 1 and 500),
 rarity text not null check(rarity in ('Common','Rare','Epic','Legendary')), duo boolean not null default false,
 supply integer check(supply > 0), active boolean not null default true, created_at timestamptz not null default now()
);
create table public.attempts (
 id uuid primary key default gen_random_uuid(), player_id uuid not null references profiles,
 mission_id text not null references missions, state text not null default 'reserved' check(state in ('reserved','pending','completed','rejected','expired')),
 invite uuid not null unique default gen_random_uuid(), witness_id uuid references profiles,
 expires_at timestamptz not null default now()+interval '24 hours', created_at timestamptz not null default now(), completed_at timestamptz,
 unique(player_id,mission_id), check(witness_id is null or witness_id<>player_id)
);
create table public.reflections (
 attempt_id uuid primary key references attempts, player_id uuid not null references profiles,
 body text not null check(char_length(body) between 1 and 4000), created_at timestamptz not null default now()
);
create table public.cards (
 id uuid primary key default gen_random_uuid(), mission_id text not null references missions,
 owner_id uuid not null references profiles, attempt_id uuid not null unique references attempts,
 sealed_at timestamptz, created_at timestamptz not null default now()
);
create table public.ledger (
 id bigint generated always as identity primary key, card_id uuid not null references cards,
 actor_id uuid not null references profiles, event text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.trades (
 id uuid primary key default gen_random_uuid(), sender_id uuid not null references profiles, recipient_id uuid not null references profiles,
 offered_id uuid not null references cards, requested_id uuid not null references cards,
 state text not null default 'pending' check(state in ('pending','accepted','cancelled')), created_at timestamptz not null default now(),
 check(sender_id<>recipient_id), check(offered_id<>requested_id)
);
create table public.rewards (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 1 and 100),
 cost integer not null check(cost>0), stock integer not null check(stock>=0), active boolean not null default true
);
create table public.redemptions (
 id uuid primary key default gen_random_uuid(), player_id uuid not null references profiles, reward_id uuid not null references rewards,
 code uuid not null unique default gen_random_uuid(), cost integer not null, fulfilled_at timestamptz, created_at timestamptz not null default now(), unique(player_id,reward_id)
);
create table public.feedback (
 id uuid primary key default gen_random_uuid(), player_id uuid not null references profiles,
 body text not null check(char_length(body) between 1 and 4000), created_at timestamptz not null default now()
);
create table public.chat_messages (
 id bigint generated always as identity primary key, player_id uuid not null references profiles,
 role text not null check(role in ('user','assistant')), content text not null, created_at timestamptz not null default now()
);
create table public.ai_usage (player_id uuid not null references profiles, day date not null, count integer not null default 0, primary key(player_id,day));
create index attempts_mission on attempts(mission_id,state,expires_at);
create index cards_owner on cards(owner_id);
create index chat_owner on chat_messages(player_id,id);
create index trades_pending on trades(state);

-- Read policies. No player writes directly to protected tables.
do $$ declare t text; begin
 foreach t in array array['profiles','missions','attempts','reflections','cards','ledger','trades','rewards','redemptions','feedback','chat_messages','ai_usage'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy profiles_read on profiles for select to authenticated using(id=auth.uid() or is_admin());
create policy missions_read on missions for select to authenticated using(true);
create policy attempts_read on attempts for select to authenticated using(player_id=auth.uid() or is_admin());
create policy reflections_read on reflections for select to authenticated using(player_id=auth.uid() or is_admin());
create policy cards_read on cards for select to authenticated using(owner_id=auth.uid() or is_admin() or exists(select 1 from trades where (sender_id=auth.uid() or recipient_id=auth.uid()) and (offered_id=cards.id or requested_id=cards.id)));
create policy trades_read on trades for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid() or is_admin());
create policy ledger_read on ledger for select to authenticated using(actor_id=auth.uid() or is_admin());
create policy rewards_read on rewards for select to authenticated using(true);
create policy redemptions_read on redemptions for select to authenticated using(player_id=auth.uid() or is_admin());
create policy feedback_read on feedback for select to authenticated using(player_id=auth.uid() or is_admin());
-- Administrators never receive access to other players' AI conversations.
create policy chat_read on chat_messages for select to authenticated using(player_id=auth.uid());
create policy usage_read on ai_usage for select to authenticated using(player_id=auth.uid());

create function public.reserve_mission(p_mission text) returns uuid language plpgsql security definer set search_path=public as $$
declare m missions; a attempts; used integer; result uuid;
begin
 if auth.uid() is null then raise exception '請先登入'; end if;
 select * into m from missions where id=p_mission for update;
 if not found or not m.active then raise exception '任務未開放'; end if;
 select * into a from attempts where player_id=auth.uid() and mission_id=p_mission for update;
 if found and (a.state='completed' or (a.state in ('reserved','pending') and a.expires_at>now())) then return a.id; end if;
 select count(*) into used from attempts where mission_id=p_mission and (state='completed' or (state in ('reserved','pending') and expires_at>now()));
 if m.supply is not null and used>=m.supply then raise exception '卡牌額度已用完，請稍後再試'; end if;
 insert into attempts(player_id,mission_id) values(auth.uid(),p_mission)
 on conflict(player_id,mission_id) do update set state='reserved',invite=gen_random_uuid(),witness_id=null,expires_at=now()+interval '24 hours'
 returning id into result;
 return result;
end $$;

-- Internal only; EXECUTE is explicitly revoked below.
create function public.finish_attempt(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare a attempts; c uuid;
begin
 select * into a from attempts where id=p_id for update;
 if a.state='completed' then return; end if;
 update attempts set state='completed',completed_at=now() where id=p_id;
 insert into cards(mission_id,owner_id,attempt_id) values(a.mission_id,a.player_id,a.id) returning id into c;
 insert into ledger(card_id,actor_id,event) values(c,a.player_id,'issued');
 update profiles set credits=credits+100 where id=a.player_id;
end $$;
create function public.submit_attempt(p_id uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$
declare a attempts; m missions;
begin
 select * into a from attempts where id=p_id for update;
 if not found or a.player_id is distinct from auth.uid() then raise exception '沒有權限'; end if;
 if a.state='completed' then return; end if;
 if a.state<>'reserved' or a.expires_at<=now() then raise exception '預留已到期或已提交，請重新開啟任務'; end if;
 if char_length(trim(p_body)) not between 1 and 4000 then raise exception '請輸入 1 至 4000 字的反思'; end if;
 insert into reflections(attempt_id,player_id,body) values(a.id,a.player_id,trim(p_body)) on conflict(attempt_id) do update set body=excluded.body,created_at=now();
 select * into m from missions where id=a.mission_id;
 if m.duo then update attempts set state='pending' where id=a.id; else perform finish_attempt(a.id); end if;
end $$;
create function public.witness_preview(p_invite uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception '請先登入'; end if;
 return (select jsonb_build_object('title',m.title,'description',m.description,'player',p.display_name,'state',a.state,'expires_at',a.expires_at,'is_self',a.player_id=auth.uid()) from attempts a join missions m on m.id=a.mission_id join profiles p on p.id=a.player_id where a.invite=p_invite);
end $$;
create function public.verify_attempt(p_invite uuid,p_accept boolean) returns void language plpgsql security definer set search_path=public as $$
declare a attempts;
begin
 if auth.uid() is null then raise exception '請先登入'; end if;
 select * into a from attempts where invite=p_invite for update;
 if not found or a.player_id=auth.uid() then raise exception '需要另一位同學的帳戶確認'; end if;
 if a.state<>'pending' or a.expires_at<=now() then raise exception '邀請已處理或到期'; end if;
 update attempts set witness_id=auth.uid() where id=a.id;
 if p_accept then perform finish_attempt(a.id); else update attempts set state='rejected' where id=a.id; end if;
end $$;
create function public.seal_card(p_card uuid) returns void language plpgsql security definer set search_path=public as $$
declare c cards;
begin
 select * into c from cards where id=p_card for update;
 if not found or c.owner_id is distinct from auth.uid() then raise exception '沒有權限'; end if;
 if c.sealed_at is not null then return; end if;
 if exists(select 1 from trades where state='pending' and (offered_id=p_card or requested_id=p_card)) then raise exception '請先取消交換'; end if;
 update cards set sealed_at=now() where id=p_card;
 insert into ledger(card_id,actor_id,event) values(p_card,auth.uid(),'sealed');
end $$;
create function public.offer_trade(p_offered uuid,p_requested uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare a cards; b cards; result uuid;
begin
 -- Stable ordering prevents opposing offers from deadlocking.
 perform id from cards where id in(p_offered,p_requested) order by id for update;
 select * into a from cards where id=p_offered; select * into b from cards where id=p_requested;
 if a.id is null or b.id is null or a.owner_id is distinct from auth.uid() or b.owner_id=auth.uid() then raise exception '請確認兩張卡牌的擁有人'; end if;
 if a.sealed_at is not null or b.sealed_at is not null then raise exception '封存卡牌不可交換'; end if;
 if exists(select 1 from trades where state='pending' and (offered_id in(p_offered,p_requested) or requested_id in(p_offered,p_requested))) then raise exception '卡牌已有待處理交換'; end if;
 insert into trades(sender_id,recipient_id,offered_id,requested_id) values(auth.uid(),b.owner_id,p_offered,p_requested) returning id into result;
 return result;
end $$;
create function public.resolve_trade(p_trade uuid,p_accept boolean) returns void language plpgsql security definer set search_path=public as $$
declare t trades; a cards; b cards;
begin
 select * into t from trades where id=p_trade for update;
 if not found or auth.uid() is null or auth.uid() not in(t.sender_id,t.recipient_id) then raise exception '沒有權限'; end if;
 if t.state<>'pending' then raise exception '交換已處理'; end if;
 perform id from cards where id in(t.offered_id,t.requested_id) order by id for update;
 if p_accept then
 if auth.uid()<>t.recipient_id then raise exception '只有收件人可以接受交換'; end if;
 select * into a from cards where id=t.offered_id; select * into b from cards where id=t.requested_id;
 if a.owner_id<>t.sender_id or b.owner_id<>t.recipient_id or a.sealed_at is not null or b.sealed_at is not null then raise exception '卡牌狀態已改變'; end if;
 update cards set owner_id=t.recipient_id where id=t.offered_id;
 update cards set owner_id=t.sender_id where id=t.requested_id;
 insert into ledger(card_id,actor_id,event,details) values(t.offered_id,auth.uid(),'traded',jsonb_build_object('trade_id',t.id,'from',t.sender_id,'to',t.recipient_id)),(t.requested_id,auth.uid(),'traded',jsonb_build_object('trade_id',t.id,'from',t.recipient_id,'to',t.sender_id));
 end if;
 update trades set state=case when p_accept then 'accepted' else 'cancelled' end where id=t.id;
end $$;
create function public.redeem_reward(p_reward uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare r rewards; p profiles; result uuid;
begin
 select * into p from profiles where id=auth.uid() for update;
 if not found then raise exception '請先登入'; end if;
 select code into result from redemptions where player_id=p.id and reward_id=p_reward;
 if found then return result; end if;
 select * into r from rewards where id=p_reward for update;
 if not found or not r.active or r.stock<1 then raise exception '獎勵未開放或已換完'; end if;
 if p.credits<r.cost then raise exception '勇氣點數不足'; end if;
 update profiles set credits=credits-r.cost where id=p.id;
 update rewards set stock=stock-1 where id=r.id;
 insert into redemptions(player_id,reward_id,cost) values(p.id,r.id,r.cost) returning code into result;
 return result;
end $$;
create function public.send_feedback(p_body text) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception '請先登入'; end if;
 perform id from profiles where id=auth.uid() for update;
 if (select count(*) from feedback where player_id=auth.uid() and created_at>now()-interval '1 day')>=10 then raise exception '每日最多提交 10 次回饋'; end if;
 insert into feedback(player_id,body) values(auth.uid(),trim(p_body));
end $$;
create function public.clear_chat() returns void language plpgsql security definer set search_path=public as $$
begin delete from chat_messages where player_id=auth.uid(); end $$;
create function public.claim_ai_quota(p_player uuid) returns void language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 insert into ai_usage(player_id,day,count) values(p_player,(now() at time zone 'UTC')::date,1)
 on conflict(player_id,day) do update set count=ai_usage.count+1 returning count into n;
 if n>20 then raise exception '今日對話次數已用完（每日 20 次）'; end if;
end $$;

create function public.admin_save_mission(p_id text,p_title text,p_family text,p_description text,p_question text,p_rarity text,p_duo boolean,p_supply integer,p_active boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_admin() then raise exception '只限管理員'; end if;
 -- Existing gameplay rules are immutable after any reservation; create a new mission for changed rules.
 if exists(select 1 from missions where id=p_id) then
 update missions set active=p_active where id=p_id;
 else insert into missions(id,title,family,description,question,rarity,duo,supply,active) values(p_id,p_title,p_family,p_description,p_question,p_rarity,p_duo,p_supply,p_active); end if;
end $$;
create function public.admin_save_reward(p_title text,p_cost integer,p_stock integer) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception '只限管理員'; end if;
 insert into rewards(title,cost,stock) values(p_title,p_cost,p_stock); end $$;
create function public.admin_reward_active(p_id uuid,p_active boolean) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception '只限管理員'; end if; update rewards set active=p_active where id=p_id; end $$;
create function public.fulfill_reward(p_code uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_admin() then raise exception '只限管理員'; end if;
 update redemptions set fulfilled_at=now() where code=p_code and fulfilled_at is null;
 if not found then raise exception '兌換碼不存在或已核銷'; end if;
end $$;

-- Revoke PUBLIC default execute; only the named entry points are callable.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_admin','on_signup','on_email_change','reserve_mission','finish_attempt','submit_attempt','witness_preview','verify_attempt','seal_card','offer_trade','resolve_trade','redeem_reward','send_feedback','clear_chat','claim_ai_quota','admin_save_mission','admin_save_reward','admin_reward_active','fulfill_reward') loop
 execute format('revoke execute on function %s from public, anon, authenticated',f.sig);
 end loop;
end $$;
grant execute on function public.is_admin(),public.reserve_mission(text),public.submit_attempt(uuid,text),public.witness_preview(uuid),public.verify_attempt(uuid,boolean),public.seal_card(uuid),public.offer_trade(uuid,uuid),public.resolve_trade(uuid,boolean),public.redeem_reward(uuid),public.send_feedback(text),public.clear_chat(),public.admin_save_mission(text,text,text,text,text,text,boolean,integer,boolean),public.admin_save_reward(text,integer,integer),public.admin_reward_active(uuid,boolean),public.fulfill_reward(uuid) to authenticated;
grant execute on function public.claim_ai_quota(uuid) to service_role;
grant all on public.chat_messages,public.ai_usage to service_role;
grant usage,select on all sequences in schema public to service_role;

insert into missions(id,title,family,description,question,rarity,duo,supply) values
('HK006','交換唔包成交','敢問雞','向朋友提出交換一件普通文具的請求；對方可以接受或拒絕。','開口前最擔心甚麼？','Common',true,null),
('HK027','茶記怪菜單','歪歪貓','三分鐘內設計一款荒誕茶記菜式，保留第一稿。','你最想修改哪一部分？','Common',false,null),
('HK046','紙塔突然改規','隨風雀','與朋友搭紙塔，途中由朋友提出新限制，再一起調整。','規則改變時，你有甚麼反應？','Rare',true,20),
('HK065','紙波球評家','問問兔','請教一句球賽旁述技巧，再試做十秒紙波賽旁述。','你學到哪一招？','Common',false,null),
('HK082','港式怪發明','出聲鴨','畫出一件處理濕遮或濕鞋的怪發明，向朋友介紹。','有人聽到你的點子時，你感覺如何？','Epic',true,10),
('HK109','港式傳畫筒','再嚟龜','朋友輪流畫圖、口述、再畫，最後比較成品。','結果與想像有甚麼不同？','Legendary',true,5);
